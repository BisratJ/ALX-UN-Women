#!/usr/bin/env python3
"""
ALX × UN Women: Data Cleaning & Normalization Pipeline
========================================================
Ingests CS and DA Excel workbooks, normalizes schemas, maps health statuses
to 4 unified buckets, fixes payment overdue bug, and exports clean JSON
for the dashboard frontend.

Usage:
    python3 clean_data.py

Output:
    data.json: Single JSON file consumed by the dashboard
"""

import json
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

CS_FILE = os.path.join(SCRIPT_DIR, "Cyber Security (CS)_UN_Women_Learner_Data.xlsx")
DA_FILE = os.path.join(SCRIPT_DIR, "Data Analytics_UN_Women_Learner_Data.xlsx")
OUTPUT_FILE = os.path.join(SCRIPT_DIR, "data.json")

# Unified health taxonomy mapping
HEALTH_MAP_CS = {
    "active": "Healthy / On-Track",
    "on-track": "Healthy / On-Track",
    "at-risk": "At Risk",
}

HEALTH_MAP_DA = {
    "Active state": "Healthy / On-Track",
    "Graduated": "Healthy / On-Track",
    "Slow but progressing state": "Needs Support",
    "Stalled state": "Needs Support",
    "At risk state": "At Risk",
    "Disengaged state": "At Risk",
    "Not activated or no sign of life": "Un-onboarded / Inactive",
}

SENTINEL_DATE = "1970-01-01"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_email(email):
    """Normalize email to lowercase, stripped."""
    if pd.isna(email) or not email:
        return ""
    return str(email).strip().lower()


def clean_bool(val):
    """Convert Yes/No/NaN to boolean."""
    if pd.isna(val):
        return False
    return str(val).strip().lower() == "yes"


def clean_date(val):
    """Convert dates: treat 1970-01-01 sentinel as None."""
    if pd.isna(val) or not val:
        return None
    s = str(val).strip()
    if s.startswith(SENTINEL_DATE):
        return None
    # Try parsing common formats
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
        return round(float(val), 1)
    except (ValueError, TypeError):
        return None


def clean_phone(val):
    """Normalize phone numbers."""
    if pd.isna(val) or not val:
        return ""
    s = str(val).strip()
    # Remove trailing .0 from numeric reads
    if s.endswith(".0"):
        s = s[:-2]
    # Normalize Ethiopian numbers
    if s.startswith("0") and len(s) == 10:
        s = "+251" + s[1:]
    elif s.startswith("251") and not s.startswith("+"):
        s = "+" + s
    return s


# ---------------------------------------------------------------------------
# Ingest CS Data
# ---------------------------------------------------------------------------

def ingest_cs_registered():
    """
    Ingest the CS registered sheet.
    Quirk: Row 0 has a learner name in col A with 'Phone','Email','Program' in B-D.
    So the real column headers are Name, Phone, Email, Program.
    """
    df = pd.read_excel(CS_FILE, sheet_name="UN All Registered Cyber securit", header=None)
    # Keep only first 4 columns (rest are empty)
    df = df.iloc[:, :4]
    df.columns = ["name", "phone", "email", "program"]
    # All rows are data (including row 0 which has the first learner)
    df["email"] = df["email"].apply(clean_email)
    df["phone"] = df["phone"].apply(clean_phone)
    df["name"] = df["name"].apply(lambda x: str(x).strip() if pd.notna(x) else "")
    df = df[df["email"] != ""].copy()
    print(f"  CS Registered: {len(df)} learners ({df['email'].nunique()} unique emails)")
    return df


def ingest_cs_tracker():
    """Ingest the CS tracker sheet."""
    df = pd.read_excel(CS_FILE, sheet_name="Exported from tracker CS")
    print(f"  CS Tracker: {len(df)} rows, {df['Email'].nunique()} unique learners")
    return df


def process_cs(cs_tracker, cs_registered):
    """Process CS data into normalized learner-level and assignment-level records."""
    
    un_emails = set(cs_registered["email"].tolist())
    
    # --- Assignment-level records ---
    assignments = []
    for _, row in cs_tracker.iterrows():
        email = clean_email(row.get("Email"))
        if not email:
            continue
        
        is_un_sponsored = email in un_emails
        
        # Map health status
        raw_health = str(row.get("Learner classification status", "")).strip()
        unified_health = HEALTH_MAP_CS.get(raw_health, "Un-onboarded / Inactive")
        
        # Fix payment bug
        raw_payment = str(row.get("Payment access status", "")).strip()
        if is_un_sponsored and raw_payment == "Payment overdue":
            payment_status = "UN Women Sponsored"
        elif is_un_sponsored:
            payment_status = "UN Women Sponsored"
        else:
            payment_status = raw_payment
        
        assignments.append({
            "track": "Cybersecurity",
            "email": email,
            "full_name": str(row.get("Full name", "")).strip(),
            "phone": clean_phone(row.get("Phone number")),
            "country": str(row.get("Country of residence", "")).strip(),
            "gender": str(row.get("Gender", "")).strip(),
            "cohort": str(row.get("Cohort name", "")).strip(),
            "course_status": str(row.get("Course status", "")).strip(),
            "assignment_name": str(row.get("Assignment name", "")).strip(),
            "track_name": str(row.get("Track name", "")).strip(),
            "assignment_type": str(row.get("Assignment type", "")).strip(),
            "is_accessed": clean_bool(row.get("Is assignment accessed")),
            "is_submitted": clean_bool(row.get("Is assignment submitted")),
            "submitted_at": clean_date(row.get("Assignment submitted at")),
            "is_passed": clean_bool(row.get("Is assignment passed")),
            "has_lms_login": clean_bool(row.get("Has logged into LMS")),
            "has_ehub_login": clean_bool(row.get("Has logged into ehub")),
            "is_enrollment_activated": clean_bool(row.get("Is enrollment activated")),
            "lms_overall_score": clean_float(row.get("LMS overall score")),
            "num_assignments": clean_float(row.get("No. of assignments")),
            "num_submissions": clean_float(row.get("No. of submissions")),
            "num_passed": clean_float(row.get("No. of assignment passed")),
            "raw_health": raw_health,
            "unified_health": unified_health,
            "payment_status": payment_status,
            "is_un_sponsored": is_un_sponsored,
            "is_graduated": clean_bool(row.get("Is graduated on savannah")),
            "class_enrollment_status": str(row.get("Class enrollment status", "")).strip(),
        })
    
    assignments_df = pd.DataFrame(assignments)
    
    # --- Filter: Keep only UN-sponsored learners ---
    assignments_df = assignments_df[assignments_df["is_un_sponsored"] == True].copy()
    print(f"    CS after filtering non-UN learners: {assignments_df['email'].nunique()} unique learners")
    
    # --- Learner-level summary (one row per learner) ---
    learner_summaries = []
    for email, group in assignments_df.groupby("email"):
        first = group.iloc[0]
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
            "lms_overall_score": first["lms_overall_score"],
            "num_assignments_total": int(first["num_assignments"] or 0),
            "num_submissions": int(first["num_submissions"] or 0),
            "num_passed": int(first["num_passed"] or 0),
            "assignments_accessed": int(group["is_accessed"].sum()),
            "assignments_submitted": int(group["is_submitted"].sum()),
            "assignments_passed": int(group["is_passed"].sum()),
            "unified_health": first["unified_health"],
            "raw_health": first["raw_health"],
            "payment_status": first["payment_status"],
            "is_un_sponsored": first["is_un_sponsored"],
            "is_graduated": first["is_graduated"],
            "last_submission_date": group["submitted_at"].dropna().max() if group["submitted_at"].dropna().any() else None,
        })
    
    # --- Add un-onboarded registered learners (in UN list but not in tracker) ---
    tracker_emails = set(assignments_df["email"].unique())
    for _, row in cs_registered.iterrows():
        if row["email"] not in tracker_emails:
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
                "unified_health": "Un-onboarded / Inactive",
                "raw_health": "Not in tracker",
                "payment_status": "UN Women Sponsored",
                "is_un_sponsored": True,
                "is_graduated": False,
                "last_submission_date": None,
            })
    
    return pd.DataFrame(learner_summaries), assignments_df


# ---------------------------------------------------------------------------
# Ingest DA Data
# ---------------------------------------------------------------------------

def ingest_da_registered():
    """Ingest the DA registered sheet."""
    df = pd.read_excel(DA_FILE, sheet_name="UN All Registered Data Analytic")
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Name": "name"})
    df["email"] = df["Email"].apply(clean_email)
    df["phone"] = df["Phone"].apply(clean_phone)
    df["name"] = df["name"].apply(lambda x: str(x).strip() if pd.notna(x) else "")
    df = df[df["email"] != ""].copy()
    print(f"  DA Registered: {len(df)} learners ({df['email'].nunique()} unique emails)")
    return df


def ingest_da_tracker():
    """Ingest the DA tracker sheet (use 'Exported from tracker DA', skip duplicate 'DA')."""
    df = pd.read_excel(DA_FILE, sheet_name="Exported from tracker DA")
    print(f"  DA Tracker: {len(df)} rows, {df['Email'].nunique()} unique learners")
    return df


def process_da(da_tracker, da_registered):
    """Process DA data into normalized learner-level and assignment-level records."""
    
    un_emails = set(da_registered["email"].tolist())
    
    # --- Assignment-level records ---
    assignments = []
    for _, row in da_tracker.iterrows():
        email = clean_email(row.get("Email"))
        if not email:
            continue
        
        is_un_sponsored = email in un_emails
        
        # Build full name from first + last
        first_name = str(row.get("First name", "")).strip()
        last_name = str(row.get("Last name", "")).strip()
        full_name = f"{first_name} {last_name}".strip()
        
        # Map health status
        raw_health = str(row.get("Learner health classification", "")).strip()
        unified_health = HEALTH_MAP_DA.get(raw_health, "Un-onboarded / Inactive")
        
        # Fix payment bug
        raw_payment = str(row.get("Payment status", "")).strip()
        if is_un_sponsored:
            payment_status = "UN Women Sponsored"
        else:
            payment_status = raw_payment
        
        assignments.append({
            "track": "Data Analytics",
            "email": email,
            "full_name": full_name,
            "phone": clean_phone(row.get("Phone number")),
            "country": str(row.get("Country of residence", "")).strip(),
            "gender": str(row.get("Gender", "")).strip(),
            "cohort": "",  # DA doesn't have cohort name
            "course_name": str(row.get("Course name", "")).strip(),
            "course_status": str(row.get("Course status (LMS)", "")).strip(),
            "assignment_name": str(row.get("Assignment name", "")).strip(),
            "track_name": str(row.get("Course name", "")).strip(),  # Use course name as track
            "assignment_type": str(row.get("Assignment type", "")).strip(),
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
            "raw_health": raw_health,
            "unified_health": unified_health,
            "payment_status": payment_status,
            "is_un_sponsored": is_un_sponsored,
            "is_graduated": clean_bool(row.get("Is graduated on savannah")),
            "is_program_graduated": clean_bool(row.get("Is program graduated")),
            "course_sequence": clean_float(row.get("Course sequence number")),
        })
    
    assignments_df = pd.DataFrame(assignments)
    
    # --- Filter: Keep only UN-sponsored learners ---
    assignments_df = assignments_df[assignments_df["is_un_sponsored"] == True].copy()
    print(f"    DA after filtering non-UN learners: {assignments_df['email'].nunique()} unique learners")
    
    # --- Learner-level summary ---
    learner_summaries = []
    for email, group in assignments_df.groupby("email"):
        first = group.iloc[0]
        
        # Calculate LMS overall score as average of non-null assignment scores
        scores = group["assignment_score"].dropna()
        avg_score = round(scores.mean(), 1) if len(scores) > 0 else None
        
        learner_summaries.append({
            "track": "Data Analytics",
            "email": email,
            "full_name": first["full_name"],
            "phone": first["phone"],
            "country": first["country"],
            "cohort": first.get("cohort", ""),
            "has_lms_login": first["has_lms_login"],
            "has_ehub_login": first["has_ehub_login"],
            "is_enrollment_activated": first["is_enrollment_activated"],
            "lms_overall_score": avg_score,
            "num_assignments_total": len(group),
            "num_submissions": int(group["is_submitted"].sum()),
            "num_passed": int(group["is_passed"].sum()),
            "assignments_accessed": int(group["is_accessed"].sum()),
            "assignments_submitted": int(group["is_submitted"].sum()),
            "assignments_passed": int(group["is_passed"].sum()),
            "unified_health": first["unified_health"],
            "raw_health": first["raw_health"],
            "payment_status": first["payment_status"],
            "is_un_sponsored": first["is_un_sponsored"],
            "is_graduated": first["is_graduated"],
            "last_submission_date": group["submitted_at"].dropna().max() if group["submitted_at"].dropna().any() else None,
        })
    
    # --- Add un-onboarded registered learners ---
    tracker_emails = set(assignments_df["email"].unique())
    for _, row in da_registered.iterrows():
        if row["email"] not in tracker_emails:
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
                "unified_health": "Un-onboarded / Inactive",
                "raw_health": "Not in tracker",
                "payment_status": "UN Women Sponsored",
                "is_un_sponsored": True,
                "is_graduated": False,
                "last_submission_date": None,
            })
    
    return pd.DataFrame(learner_summaries), assignments_df


# ---------------------------------------------------------------------------
# Build Funnel Data
# ---------------------------------------------------------------------------

def build_funnel(learners_df, track_name):
    """Build funnel metrics for a track."""
    track = learners_df[learners_df["track"] == track_name]
    un = track[track["is_un_sponsored"] == True]
    
    return {
        "registered": len(un),
        "logged_into_lms": int(un["has_lms_login"].sum()),
        "activated": int(un["is_enrollment_activated"].sum()),
        "submitted_first": int((un["assignments_submitted"] > 0).sum()),
        "graduated": int(un["is_graduated"].sum()),
    }


def build_health_distribution(learners_df, track_name):
    """Build health status distribution for a track."""
    track = learners_df[learners_df["track"] == track_name]
    un = track[track["is_un_sponsored"] == True]
    
    counts = un["unified_health"].value_counts().to_dict()
    return {
        "Healthy / On-Track": counts.get("Healthy / On-Track", 0),
        "Needs Support": counts.get("Needs Support", 0),
        "At Risk": counts.get("At Risk", 0),
        "Un-onboarded / Inactive": counts.get("Un-onboarded / Inactive", 0),
    }


# ---------------------------------------------------------------------------
# Build Assignment Heatmap Data
# ---------------------------------------------------------------------------

def build_assignment_heatmap(assignments_df, track_name):
    """Build assignment completion heatmap data."""
    track = assignments_df[assignments_df["track"] == track_name]
    
    if track.empty:
        return []
    
    # Group by assignment, compute rates
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
    
    # Sort by pass rate ascending (worst bottlenecks first)
    heatmap.sort(key=lambda x: x["pass_rate"])
    return heatmap


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("\n" + "=" * 60)
    print("  ALX × UN Women: Data Pipeline")
    print("=" * 60)
    
    # --- 1. Ingest ---
    print("\n[1/5] Ingesting source data...")
    cs_registered = ingest_cs_registered()
    cs_tracker = ingest_cs_tracker()
    da_registered = ingest_da_registered()
    da_tracker = ingest_da_tracker()
    
    # --- 2. Process ---
    print("\n[2/5] Processing and normalizing...")
    cs_learners, cs_assignments = process_cs(cs_tracker, cs_registered)
    da_learners, da_assignments = process_da(da_tracker, da_registered)
    
    # --- 3. Merge ---
    all_learners = pd.concat([cs_learners, da_learners], ignore_index=True)
    all_assignments = pd.concat([cs_assignments, da_assignments], ignore_index=True)
    
    print(f"\n[3/5] Combined: {len(all_learners)} learners, {len(all_assignments)} assignment records")
    
    # --- 4. Build dashboard data ---
    print("\n[4/5] Building dashboard metrics...")
    
    un_learners = all_learners[all_learners["is_un_sponsored"] == True]
    
    # KPI metrics
    kpis = {
        "total_un_seats": 500,
        "total_registered": int(un_learners.shape[0]),
        "cs_registered": int(un_learners[un_learners["track"] == "Cybersecurity"].shape[0]),
        "da_registered": int(un_learners[un_learners["track"] == "Data Analytics"].shape[0]),
        "total_lms_login": int(un_learners["has_lms_login"].sum()),
        "total_activated": int(un_learners["is_enrollment_activated"].sum()),
        "total_submitted": int((un_learners["assignments_submitted"] > 0).sum()),
        "total_graduated": int(un_learners["is_graduated"].sum()),
        "total_healthy": int((un_learners["unified_health"] == "Healthy / On-Track").sum()),
        "total_needs_support": int((un_learners["unified_health"] == "Needs Support").sum()),
        "total_at_risk": int((un_learners["unified_health"] == "At Risk").sum()),
        "total_unonboarded": int((un_learners["unified_health"] == "Un-onboarded / Inactive").sum()),
    }
    
    # Funnel data
    funnels = {
        "cs": build_funnel(all_learners, "Cybersecurity"),
        "da": build_funnel(all_learners, "Data Analytics"),
    }
    
    # Health distributions
    health = {
        "cs": build_health_distribution(all_learners, "Cybersecurity"),
        "da": build_health_distribution(all_learners, "Data Analytics"),
    }
    
    # Assignment heatmaps
    heatmaps = {
        "cs": build_assignment_heatmap(all_assignments, "Cybersecurity"),
        "da": build_assignment_heatmap(all_assignments, "Data Analytics"),
    }
    
    # --- 5. Export ---
    # Helper to replace NaN floats with None for valid JSON syntax
    def sanitize_obj(obj):
        if isinstance(obj, float):
            import math
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
        "health": health,
        "heatmaps": sanitize_obj(heatmaps),
        "learners": clean_learners,
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)
    
    print(f"\n[5/5] Exported to: {OUTPUT_FILE}")
    print(f"   File size: {os.path.getsize(OUTPUT_FILE) / 1024:.1f} KB")
    
    # --- Summary ---
    print("\n" + "-" * 60)
    print("  Summary")
    print("-" * 60)
    print(f"  UN Sponsored Learners: {kpis['total_registered']}")
    print(f"    CS: {kpis['cs_registered']}  |  DA: {kpis['da_registered']}")
    print(f"  Logged into LMS: {kpis['total_lms_login']}")
    print(f"  Activated: {kpis['total_activated']}")
    print(f"  Graduated: {kpis['total_graduated']}")
    print(f"  Health Distribution:")
    print(f"    Healthy: {kpis['total_healthy']}")
    print(f"    Needs Support: {kpis['total_needs_support']}")
    print(f"    At Risk: {kpis['total_at_risk']}")
    print(f"    Un-onboarded: {kpis['total_unonboarded']}")
    print(f"\n  CS Funnel: {funnels['cs']}")
    print(f"  DA Funnel: {funnels['da']}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
