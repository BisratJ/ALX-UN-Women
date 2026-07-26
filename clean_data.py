#!/usr/bin/env python3
"""
ALX x UN Women: Data Cleaning & Classification Pipeline (v2)
=============================================================
Implements the revised 2-axis learner classification system:
  - Activation: Not Activated / Activated
  - Performance: Lagging Behind / On Track / N/A

Business Rules (per specification):
  DA Activation: Enrolled Activated=Yes AND Course Status=Validated -> Activated
  DA Performance: 3+ submissions AND class=DA-3_rolling -> On Track
  CS Activation: LMS Overall Score > 0 -> Activated
  CS Performance: LMS Overall Score > 50 -> On Track

Usage:
    python3 clean_data.py

Output:
    data.json - Dashboard-ready JSON
    validation_report.txt - Data quality findings
"""

import json
import math
import os
import sys
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas is required. Install with: pip3 install pandas openpyxl")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Support both original and (1)-suffixed filenames
CS_FILE_CANDIDATES = [
    os.path.join(SCRIPT_DIR, "Cyber Security (CS)_UN_Women_Learner_Data (1).xlsx"),
    os.path.join(SCRIPT_DIR, "Cyber Security (CS)_UN_Women_Learner_Data.xlsx"),
]
DA_FILE_CANDIDATES = [
    os.path.join(SCRIPT_DIR, "Data Analytics_UN_Women_Learner_Data (1).xlsx"),
    os.path.join(SCRIPT_DIR, "Data Analytics_UN_Women_Learner_Data.xlsx"),
]

OUTPUT_FILE = os.path.join(SCRIPT_DIR, "data.json")
REPORT_FILE = os.path.join(SCRIPT_DIR, "validation_report.txt")

SENTINEL_DATE = "1970-01-01"

# DA eHub class names for performance classification
DA_LAGGING_CLASSES = {"WALX_C#1", "DA-1_rolling", "DA-2_rolling"}
DA_ONTRACK_CLASS = "DA-3_rolling"


def find_file(candidates):
    """Find the first existing file from a list of candidates."""
    for path in candidates:
        if os.path.exists(path):
            return path
    raise FileNotFoundError(
        f"None of the expected files found:\n" +
        "\n".join(f"  - {c}" for c in candidates)
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_email(email):
    """Normalize email: lowercase, strip whitespace."""
    if pd.isna(email) or not email:
        return ""
    return str(email).strip().lower()


def clean_bool(val):
    """Convert Yes/No/NaN to boolean."""
    if pd.isna(val):
        return False
    return str(val).strip().lower() == "yes"


def clean_date(val):
    """Convert dates; treat 1970-01-01 sentinel as None."""
    if pd.isna(val) or not val:
        return None
    s = str(val).strip()
    if s.startswith(SENTINEL_DATE):
        return None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def clean_float(val):
    """Convert to float or None."""
    if pd.isna(val) or val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 1)
    except (ValueError, TypeError):
        return None


def clean_int(val):
    """Convert to int or 0."""
    if pd.isna(val) or val is None:
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


def clean_phone(val):
    """Normalize phone numbers."""
    if pd.isna(val) or not val:
        return ""
    s = str(val).strip()
    if s.endswith(".0"):
        s = s[:-2]
    if s.startswith("0") and len(s) == 10:
        s = "+251" + s[1:]
    elif s.startswith("251") and not s.startswith("+"):
        s = "+" + s
    return s


def clean_str(val):
    """Clean string value."""
    if pd.isna(val) or val is None:
        return ""
    return str(val).strip()


# ---------------------------------------------------------------------------
# Classification Logic (per specification)
# ---------------------------------------------------------------------------

def classify_da_activation(is_enrollment_activated, course_status_lms):
    """
    DA Activation Rules:
      Not Activated: Enrollment Activated = No AND LMS Course Status = In Progress
      Activated: Enrollment Activated = Yes AND LMS Course Status = Validated
    For edge cases (neither condition met), use enrollment_activated as primary signal.
    """
    ea = bool(is_enrollment_activated)
    cs = str(course_status_lms).strip().lower() if course_status_lms else ""

    if ea and cs == "validated":
        return "Activated"
    if not ea and cs == "in progress":
        return "Not Activated"
    # Edge cases: enrollment activated is the primary signal
    if ea:
        return "Activated"
    return "Not Activated"


def classify_da_performance(num_submissions, ehub_class_name, activation_status):
    """
    DA Performance Rules:
      Lagging Behind: 1-2 submissions AND class in (WALX_C#1, DA-1_rolling, DA-2_rolling)
      On Track: 3+ submissions AND class = DA-3_rolling
    If Not Activated, performance is N/A.
    """
    if activation_status == "Not Activated":
        return "N/A"

    subs = int(num_submissions) if num_submissions else 0
    cls_name = str(ehub_class_name).strip() if ehub_class_name else ""

    if subs >= 3 and cls_name == DA_ONTRACK_CLASS:
        return "On Track"
    if 1 <= subs <= 2 and cls_name in DA_LAGGING_CLASSES:
        return "Lagging Behind"
    # Edge: has submissions but class doesn't match specific rules
    if subs >= 3:
        return "On Track"
    if subs >= 1:
        return "Lagging Behind"
    # No submissions but activated
    return "Lagging Behind"


def classify_cs_activation(lms_overall_score):
    """
    CS Activation Rules:
      Not Activated: LMS Overall Score = 0
      Activated: LMS Overall Score > 0
    """
    score = clean_float(lms_overall_score)
    if score is None or score == 0:
        return "Not Activated"
    return "Activated"


def classify_cs_performance(lms_overall_score, activation_status):
    """
    CS Performance Rules:
      Lagging Behind: LMS Overall Score between 1 and 50
      On Track: LMS Overall Score > 50
    If Not Activated, performance is N/A.
    """
    if activation_status == "Not Activated":
        return "N/A"

    score = clean_float(lms_overall_score)
    if score is None:
        return "N/A"
    if score > 50:
        return "On Track"
    if score >= 1:
        return "Lagging Behind"
    return "N/A"


# ---------------------------------------------------------------------------
# Validation Report
# ---------------------------------------------------------------------------

class ValidationReport:
    """Collects data quality findings."""

    def __init__(self):
        self.findings = []
        self.stats = {}

    def add(self, category, message):
        self.findings.append(f"[{category}] {message}")

    def set_stat(self, key, value):
        self.stats[key] = value

    def write(self, path):
        with open(path, "w", encoding="utf-8") as f:
            f.write("=" * 70 + "\n")
            f.write("  ALX x UN Women - Data Validation Report\n")
            f.write(f"  Generated: {datetime.now().isoformat()}\n")
            f.write("=" * 70 + "\n\n")

            f.write("--- Summary Statistics ---\n")
            for k, v in self.stats.items():
                f.write(f"  {k}: {v}\n")

            f.write(f"\n--- Findings ({len(self.findings)}) ---\n")
            for finding in self.findings:
                f.write(f"  {finding}\n")

            if not self.findings:
                f.write("  No issues found.\n")

            f.write("\n" + "=" * 70 + "\n")


# ---------------------------------------------------------------------------
# Ingest CS Data
# ---------------------------------------------------------------------------

def ingest_cs_registered(cs_file, report):
    """Ingest the CS registered sheet."""
    df = pd.read_excel(cs_file, sheet_name="UN All Registered Cyber securit", header=None)
    # First row contains data (not headers); columns: Name, Phone, Email, Program
    df = df.iloc[:, :4]
    df.columns = ["name", "phone", "email", "program"]
    df["email"] = df["email"].apply(clean_email)
    df["phone"] = df["phone"].apply(clean_phone)
    df["name"] = df["name"].apply(lambda x: clean_str(x))

    # Remove empty emails
    before = len(df)
    df = df[df["email"] != ""].copy()

    # Deduplicate by email
    dupes = df[df.duplicated(subset=["email"], keep="first")]
    if len(dupes) > 0:
        report.add("CS-REG", f"{len(dupes)} duplicate emails removed from registered list")
        for _, d in dupes.iterrows():
            report.add("CS-REG-DUPE", f"Duplicate: {d['email']} ({d['name']})")
    df = df.drop_duplicates(subset=["email"], keep="first")

    report.set_stat("CS Registered (raw)", before)
    report.set_stat("CS Registered (clean)", len(df))
    print(f"  CS Registered: {len(df)} learners ({df['email'].nunique()} unique emails)")
    return df


def ingest_cs_tracker(cs_file, report):
    """Ingest the CS tracker sheet."""
    df = pd.read_excel(cs_file, sheet_name="Exported from tracker CS")

    # Check for missing emails
    missing_email = df[df["Email"].isna() | (df["Email"].astype(str).str.strip() == "")]
    if len(missing_email) > 0:
        report.add("CS-TRACK", f"{len(missing_email)} rows with missing email in tracker")

    report.set_stat("CS Tracker rows", len(df))
    report.set_stat("CS Tracker unique emails", df["Email"].nunique())
    print(f"  CS Tracker: {len(df)} rows, {df['Email'].nunique()} unique learners")
    return df


def process_cs(cs_tracker, cs_registered, report):
    """Process CS data with new 2-axis classification."""

    un_emails = set(cs_registered["email"].tolist())

    # Assignment-level records
    assignments = []
    for _, row in cs_tracker.iterrows():
        email = clean_email(row.get("Email"))
        if not email:
            continue

        is_un_sponsored = email in un_emails

        # Payment fix
        raw_payment = clean_str(row.get("Payment access status"))
        if is_un_sponsored:
            payment_status = "UN Women Sponsored"
        else:
            payment_status = raw_payment

        lms_score = clean_float(row.get("LMS overall score"))

        assignments.append({
            "track": "Cybersecurity",
            "email": email,
            "full_name": clean_str(row.get("Full name")),
            "phone": clean_phone(row.get("Phone number")),
            "country": clean_str(row.get("Country of residence")),
            "gender": clean_str(row.get("Gender")),
            "cohort": clean_str(row.get("Cohort name")),
            "course_status": clean_str(row.get("Course status")),
            "assignment_name": clean_str(row.get("Assignment name")),
            "track_name": clean_str(row.get("Track name")),
            "assignment_type": clean_str(row.get("Assignment type")),
            "is_accessed": clean_bool(row.get("Is assignment accessed")),
            "is_submitted": clean_bool(row.get("Is assignment submitted")),
            "submitted_at": clean_date(row.get("Assignment submitted at")),
            "is_passed": clean_bool(row.get("Is assignment passed")),
            "has_lms_login": clean_bool(row.get("Has logged into LMS")),
            "has_ehub_login": clean_bool(row.get("Has logged into ehub")),
            "is_enrollment_activated": clean_bool(row.get("Is enrollment activated")),
            "lms_overall_score": lms_score,
            "num_assignments": clean_int(row.get("No. of assignments")),
            "num_submissions": clean_int(row.get("No. of submissions")),
            "num_passed": clean_int(row.get("No. of assignment passed")),
            "raw_health": clean_str(row.get("Learner classification status")),
            "payment_status": payment_status,
            "is_un_sponsored": is_un_sponsored,
            "is_graduated": clean_bool(row.get("Is graduated on savannah")),
            "class_enrollment_status": clean_str(row.get("Class enrollment status")),
        })

    assignments_df = pd.DataFrame(assignments)

    # Filter: Only UN-sponsored learners
    assignments_df = assignments_df[assignments_df["is_un_sponsored"] == True].copy()
    print(f"    CS after filtering non-UN: {assignments_df['email'].nunique()} unique learners")

    # Learner-level summary (one row per learner)
    learner_summaries = []
    for email, group in assignments_df.groupby("email"):
        first = group.iloc[0]
        lms_score = first["lms_overall_score"]

        # 2-axis classification
        activation_status = classify_cs_activation(lms_score)
        performance_status = classify_cs_performance(lms_score, activation_status)

        learner_summaries.append({
            "track": "Cybersecurity",
            "email": email,
            "full_name": first["full_name"],
            "phone": first["phone"],
            "country": first["country"],
            "cohort": first["cohort"],
            "has_lms_login": first["has_lms_login"],
            "has_ehub_login": first["has_ehub_login"],
            "is_enrollment_activated": first["is_enrollment_activated"],
            "lms_overall_score": lms_score,
            "num_assignments_total": int(first["num_assignments"] or 0),
            "num_submissions": int(first["num_submissions"] or 0),
            "num_passed": int(first["num_passed"] or 0),
            "assignments_accessed": int(group["is_accessed"].sum()),
            "assignments_submitted": int(group["is_submitted"].sum()),
            "assignments_passed": int(group["is_passed"].sum()),
            "activation_status": activation_status,
            "performance_status": performance_status,
            "raw_health": first["raw_health"],
            "payment_status": first["payment_status"],
            "is_un_sponsored": True,
            "is_graduated": first["is_graduated"],
            "last_submission_date": group["submitted_at"].dropna().max() if group["submitted_at"].dropna().any() else None,
        })

    # Add un-onboarded registered learners (in UN list but not in tracker)
    tracker_emails = set(assignments_df["email"].unique())
    missing_from_tracker = 0
    for _, row in cs_registered.iterrows():
        if row["email"] not in tracker_emails:
            missing_from_tracker += 1
            learner_summaries.append({
                "track": "Cybersecurity",
                "email": row["email"],
                "full_name": row["name"],
                "phone": row["phone"],
                "country": "",
                "cohort": "",
                "has_lms_login": False,
                "has_ehub_login": False,
                "is_enrollment_activated": False,
                "lms_overall_score": None,
                "num_assignments_total": 0,
                "num_submissions": 0,
                "num_passed": 0,
                "assignments_accessed": 0,
                "assignments_submitted": 0,
                "assignments_passed": 0,
                "activation_status": "Not Activated",
                "performance_status": "N/A",
                "raw_health": "Not in tracker",
                "payment_status": "UN Women Sponsored",
                "is_un_sponsored": True,
                "is_graduated": False,
                "last_submission_date": None,
            })

    if missing_from_tracker > 0:
        report.add("CS-MATCH", f"{missing_from_tracker} registered learners not found in tracker")

    report.set_stat("CS Learners (final)", len(learner_summaries))
    return pd.DataFrame(learner_summaries), assignments_df


# ---------------------------------------------------------------------------
# Ingest DA Data
# ---------------------------------------------------------------------------

def ingest_da_registered(da_file, report):
    """Ingest the DA registered sheet."""
    df = pd.read_excel(da_file, sheet_name="UN All Registered Data Analytic")
    df.columns = [c.strip() for c in df.columns]

    # Handle column name variations
    name_col = "Name" if "Name" in df.columns else df.columns[0]
    df = df.rename(columns={name_col: "name"})
    df["email"] = df["Email"].apply(clean_email)
    df["phone"] = df["Phone"].apply(clean_phone)
    df["name"] = df["name"].apply(lambda x: clean_str(x))

    before = len(df)
    df = df[df["email"] != ""].copy()

    # Deduplicate
    dupes = df[df.duplicated(subset=["email"], keep="first")]
    if len(dupes) > 0:
        report.add("DA-REG", f"{len(dupes)} duplicate emails removed from registered list")
    df = df.drop_duplicates(subset=["email"], keep="first")

    report.set_stat("DA Registered (raw)", before)
    report.set_stat("DA Registered (clean)", len(df))
    print(f"  DA Registered: {len(df)} learners ({df['email'].nunique()} unique emails)")
    return df


def ingest_da_tracker(da_file, report):
    """Ingest the DA tracker sheet."""
    df = pd.read_excel(da_file, sheet_name="Exported from tracker DA")

    missing_email = df[df["Email"].isna() | (df["Email"].astype(str).str.strip() == "")]
    if len(missing_email) > 0:
        report.add("DA-TRACK", f"{len(missing_email)} rows with missing email in tracker")

    report.set_stat("DA Tracker rows", len(df))
    report.set_stat("DA Tracker unique emails", df["Email"].nunique())
    print(f"  DA Tracker: {len(df)} rows, {df['Email'].nunique()} unique learners")
    return df


def process_da(da_tracker, da_registered, report):
    """Process DA data with new 2-axis classification."""

    un_emails = set(da_registered["email"].tolist())

    # Assignment-level records
    assignments = []
    for _, row in da_tracker.iterrows():
        email = clean_email(row.get("Email"))
        if not email:
            continue

        is_un_sponsored = email in un_emails

        first_name = clean_str(row.get("First name"))
        last_name = clean_str(row.get("Last name"))
        full_name = f"{first_name} {last_name}".strip()

        raw_payment = clean_str(row.get("Payment status"))
        if is_un_sponsored:
            payment_status = "UN Women Sponsored"
        else:
            payment_status = raw_payment

        assignments.append({
            "track": "Data Analytics",
            "email": email,
            "full_name": full_name,
            "phone": clean_phone(row.get("Phone number")),
            "country": clean_str(row.get("Country of residence")),
            "gender": clean_str(row.get("Gender")),
            "cohort": "",
            "course_name": clean_str(row.get("Course name")),
            "course_status_lms": clean_str(row.get("Course status (LMS)")),
            "ehub_class_name": clean_str(row.get("eHub class name")),
            "assignment_name": clean_str(row.get("Assignment name")),
            "track_name": clean_str(row.get("Course name")),
            "assignment_type": clean_str(row.get("Assignment type")),
            "is_accessed": clean_bool(row.get("Is assignment accessed")),
            "is_submitted": clean_bool(row.get("Is assignment submitted")),
            "submitted_at": clean_date(row.get("Assignment submitted date")),
            "is_passed": clean_bool(row.get("Is assignment passed")),
            "assignment_score": clean_float(row.get("Assignment score")),
            "has_lms_login": clean_bool(row.get("Has logged into LMS")),
            "has_ehub_login": clean_bool(row.get("Has logged into eHub")),
            "is_enrollment_activated": clean_bool(row.get("Is enrollment activated")),
            "activation_date": clean_date(row.get("Activation date")),
            "first_sign_of_life": clean_date(row.get("First sign of life date")),
            "raw_health": clean_str(row.get("Learner health classification")),
            "payment_status": payment_status,
            "is_un_sponsored": is_un_sponsored,
            "is_graduated": clean_bool(row.get("Is graduated on savannah")),
            "is_program_graduated": clean_bool(row.get("Is program graduated")),
            "course_sequence": clean_float(row.get("Course sequence number")),
        })

    assignments_df = pd.DataFrame(assignments)

    # Filter: Only UN-sponsored learners
    assignments_df = assignments_df[assignments_df["is_un_sponsored"] == True].copy()
    print(f"    DA after filtering non-UN: {assignments_df['email'].nunique()} unique learners")

    # Learner-level summary
    learner_summaries = []
    for email, group in assignments_df.groupby("email"):
        first = group.iloc[0]

        # LMS overall score = average of non-null assignment scores
        scores = group["assignment_score"].dropna()
        avg_score = round(scores.mean(), 1) if len(scores) > 0 else None

        # Aggregate submissions across all assignments
        total_submissions = int(group["is_submitted"].sum())

        # Get the latest eHub class name and course status
        ehub_class = first["ehub_class_name"]
        course_status = first["course_status_lms"]
        is_ea = first["is_enrollment_activated"]

        # 2-axis classification
        activation_status = classify_da_activation(is_ea, course_status)
        performance_status = classify_da_performance(total_submissions, ehub_class, activation_status)

        learner_summaries.append({
            "track": "Data Analytics",
            "email": email,
            "full_name": first["full_name"],
            "phone": first["phone"],
            "country": first["country"],
            "cohort": first.get("cohort", ""),
            "has_lms_login": first["has_lms_login"],
            "has_ehub_login": first["has_ehub_login"],
            "is_enrollment_activated": is_ea,
            "lms_overall_score": avg_score,
            "num_assignments_total": len(group),
            "num_submissions": total_submissions,
            "num_passed": int(group["is_passed"].sum()),
            "assignments_accessed": int(group["is_accessed"].sum()),
            "assignments_submitted": total_submissions,
            "assignments_passed": int(group["is_passed"].sum()),
            "activation_status": activation_status,
            "performance_status": performance_status,
            "raw_health": first["raw_health"],
            "payment_status": first["payment_status"],
            "is_un_sponsored": True,
            "is_graduated": first["is_graduated"],
            "last_submission_date": group["submitted_at"].dropna().max() if group["submitted_at"].dropna().any() else None,
        })

    # Add un-onboarded registered learners
    tracker_emails = set(assignments_df["email"].unique())
    missing_from_tracker = 0
    for _, row in da_registered.iterrows():
        if row["email"] not in tracker_emails:
            missing_from_tracker += 1
            learner_summaries.append({
                "track": "Data Analytics",
                "email": row["email"],
                "full_name": row["name"],
                "phone": row["phone"],
                "country": "",
                "cohort": "",
                "has_lms_login": False,
                "has_ehub_login": False,
                "is_enrollment_activated": False,
                "lms_overall_score": None,
                "num_assignments_total": 0,
                "num_submissions": 0,
                "num_passed": 0,
                "assignments_accessed": 0,
                "assignments_submitted": 0,
                "assignments_passed": 0,
                "activation_status": "Not Activated",
                "performance_status": "N/A",
                "raw_health": "Not in tracker",
                "payment_status": "UN Women Sponsored",
                "is_un_sponsored": True,
                "is_graduated": False,
                "last_submission_date": None,
            })

    if missing_from_tracker > 0:
        report.add("DA-MATCH", f"{missing_from_tracker} registered learners not found in tracker")

    report.set_stat("DA Learners (final)", len(learner_summaries))
    return pd.DataFrame(learner_summaries), assignments_df


# ---------------------------------------------------------------------------
# Build Funnel Data (Updated journey)
# ---------------------------------------------------------------------------

def build_funnel(learners_df, track_name):
    """
    Build funnel: UN Sponsored Seats -> LMS Onboarded -> Activated -> On Track
    Also includes: Not Activated, Lagging Behind counts.
    """
    track = learners_df[learners_df["track"] == track_name]
    un = track[track["is_un_sponsored"] == True]

    return {
        "un_sponsored_seats": len(un),
        "lms_onboarded": int(un["has_lms_login"].sum()),
        "activated": int((un["activation_status"] == "Activated").sum()),
        "on_track": int((un["performance_status"] == "On Track").sum()),
        "not_activated": int((un["activation_status"] == "Not Activated").sum()),
        "lagging_behind": int((un["performance_status"] == "Lagging Behind").sum()),
    }


def build_classification_distribution(learners_df, track_name):
    """Build activation and performance distributions for a track."""
    track = learners_df[learners_df["track"] == track_name]
    un = track[track["is_un_sponsored"] == True]

    activation_counts = un["activation_status"].value_counts().to_dict()
    performance_counts = un["performance_status"].value_counts().to_dict()

    return {
        "activation": {
            "Activated": activation_counts.get("Activated", 0),
            "Not Activated": activation_counts.get("Not Activated", 0),
        },
        "performance": {
            "On Track": performance_counts.get("On Track", 0),
            "Lagging Behind": performance_counts.get("Lagging Behind", 0),
            "N/A": performance_counts.get("N/A", 0),
        },
    }


# ---------------------------------------------------------------------------
# Build Assignment Heatmap Data
# ---------------------------------------------------------------------------

def build_assignment_heatmap(assignments_df, track_name):
    """Build assignment completion heatmap data."""
    track = assignments_df[assignments_df["track"] == track_name]
    if track.empty:
        return []

    heatmap = []
    for name, group in track.groupby("assignment_name"):
        total_learners = group["email"].nunique()
        accessed = group[group["is_accessed"] == True]["email"].nunique()
        submitted = group[group["is_submitted"] == True]["email"].nunique()
        passed = group[group["is_passed"] == True]["email"].nunique()

        heatmap.append({
            "assignment": name,
            "track_name": group.iloc[0].get("track_name", ""),
            "total_learners": total_learners,
            "accessed": accessed,
            "submitted": submitted,
            "passed": passed,
            "access_rate": round(accessed / total_learners * 100, 1) if total_learners > 0 else 0,
            "submit_rate": round(submitted / total_learners * 100, 1) if total_learners > 0 else 0,
            "pass_rate": round(passed / total_learners * 100, 1) if total_learners > 0 else 0,
        })

    heatmap.sort(key=lambda x: x["pass_rate"])
    return heatmap


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "=" * 60)
    print("  ALX x UN Women: Data Pipeline v2")
    print("  2-Axis Classification (Activation x Performance)")
    print("=" * 60)

    report = ValidationReport()

    # --- 1. Find files ---
    try:
        cs_file = find_file(CS_FILE_CANDIDATES)
        da_file = find_file(DA_FILE_CANDIDATES)
    except FileNotFoundError as e:
        print(f"\nERROR: {e}")
        sys.exit(1)

    print(f"\n  CS file: {os.path.basename(cs_file)}")
    print(f"  DA file: {os.path.basename(da_file)}")

    # --- 2. Ingest ---
    print("\n[1/5] Ingesting source data...")
    cs_registered = ingest_cs_registered(cs_file, report)
    cs_tracker = ingest_cs_tracker(cs_file, report)
    da_registered = ingest_da_registered(da_file, report)
    da_tracker = ingest_da_tracker(da_file, report)

    # --- 3. Process ---
    print("\n[2/5] Processing with 2-axis classification...")
    cs_learners, cs_assignments = process_cs(cs_tracker, cs_registered, report)
    da_learners, da_assignments = process_da(da_tracker, da_registered, report)

    # --- 4. Merge ---
    all_learners = pd.concat([cs_learners, da_learners], ignore_index=True)
    all_assignments = pd.concat([cs_assignments, da_assignments], ignore_index=True)

    # Final deduplication check
    dupe_check = all_learners[all_learners.duplicated(subset=["email", "track"], keep="first")]
    if len(dupe_check) > 0:
        report.add("MERGE", f"{len(dupe_check)} duplicate email+track combinations found and removed")
        all_learners = all_learners.drop_duplicates(subset=["email", "track"], keep="first")

    print(f"\n[3/5] Combined: {len(all_learners)} learners, {len(all_assignments)} assignment records")

    # --- 5. Build dashboard data ---
    print("\n[4/5] Building dashboard metrics...")

    un_learners = all_learners[all_learners["is_un_sponsored"] == True]

    # KPI metrics (new schema)
    kpis = {
        "total_un_seats": 500,
        "total_registered": int(un_learners.shape[0]),
        "cs_registered": int(un_learners[un_learners["track"] == "Cybersecurity"].shape[0]),
        "da_registered": int(un_learners[un_learners["track"] == "Data Analytics"].shape[0]),
        "total_lms_onboarded": int(un_learners["has_lms_login"].sum()),
        "total_activated": int((un_learners["activation_status"] == "Activated").sum()),
        "total_not_activated": int((un_learners["activation_status"] == "Not Activated").sum()),
        "total_on_track": int((un_learners["performance_status"] == "On Track").sum()),
        "total_lagging_behind": int((un_learners["performance_status"] == "Lagging Behind").sum()),
        "total_performance_na": int((un_learners["performance_status"] == "N/A").sum()),
        "total_graduated": int(un_learners["is_graduated"].sum()),
    }

    # Funnel data (new journey)
    funnels = {
        "cs": build_funnel(all_learners, "Cybersecurity"),
        "da": build_funnel(all_learners, "Data Analytics"),
    }

    # Classification distributions
    classifications = {
        "cs": build_classification_distribution(all_learners, "Cybersecurity"),
        "da": build_classification_distribution(all_learners, "Data Analytics"),
    }

    # Assignment heatmaps
    heatmaps = {
        "cs": build_assignment_heatmap(all_assignments, "Cybersecurity"),
        "da": build_assignment_heatmap(all_assignments, "Data Analytics"),
    }

    # --- 6. Export ---
    def sanitize_obj(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif isinstance(obj, dict):
            return {k: sanitize_obj(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize_obj(v) for v in obj]
        return obj

    learners_records = all_learners.where(all_learners.notna(), None).to_dict(orient="records")
    clean_learners = sanitize_obj(learners_records)

    output = {
        "generated_at": datetime.now().isoformat(),
        "kpis": kpis,
        "funnels": funnels,
        "classifications": classifications,
        "heatmaps": sanitize_obj(heatmaps),
        "learners": clean_learners,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    print(f"\n[5/5] Exported to: {OUTPUT_FILE}")
    print(f"   File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")

    # --- Validation Report ---
    report.set_stat("Total UN Learners", kpis["total_registered"])
    report.set_stat("CS Learners", kpis["cs_registered"])
    report.set_stat("DA Learners", kpis["da_registered"])
    report.set_stat("LMS Onboarded", kpis["total_lms_onboarded"])
    report.set_stat("Activated", kpis["total_activated"])
    report.set_stat("Not Activated", kpis["total_not_activated"])
    report.set_stat("On Track", kpis["total_on_track"])
    report.set_stat("Lagging Behind", kpis["total_lagging_behind"])
    report.set_stat("Graduated", kpis["total_graduated"])
    report.write(REPORT_FILE)
    print(f"   Validation report: {REPORT_FILE}")

    # --- Summary ---
    print("\n" + "-" * 60)
    print("  Summary (2-Axis Classification)")
    print("-" * 60)
    print(f"  UN Sponsored Learners: {kpis['total_registered']}")
    print(f"    CS: {kpis['cs_registered']}  |  DA: {kpis['da_registered']}")
    print(f"  LMS Onboarded: {kpis['total_lms_onboarded']}")
    print(f"  --- Activation ---")
    print(f"    Activated: {kpis['total_activated']}")
    print(f"    Not Activated: {kpis['total_not_activated']}")
    print(f"  --- Performance ---")
    print(f"    On Track: {kpis['total_on_track']}")
    print(f"    Lagging Behind: {kpis['total_lagging_behind']}")
    print(f"    N/A: {kpis['total_performance_na']}")
    print(f"  Graduated: {kpis['total_graduated']}")
    print(f"\n  CS Funnel: {funnels['cs']}")
    print(f"  DA Funnel: {funnels['da']}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
