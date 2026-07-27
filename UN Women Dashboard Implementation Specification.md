# UN Women Dashboard – Comprehensive Data Validation, UI/UX Review & Implementation Specification

## Objective

Conduct a complete end-to-end review of the UN Women Dashboard using the provided business requirements, source datasets, and dashboard screenshots.

Act as a multidisciplinary team consisting of a:

* Senior Product Designer

* Senior Dashboard Engineer

* Senior Data Analyst

* Senior Frontend Developer

* UI/UX Designer

* Data Visualization Specialist

* Software Architect

Your objective is **not only to implement the requested changes**, but also to critically evaluate the dashboard as if it were preparing for production deployment.

The final outcome should be a modern, accurate, scalable, user-friendly, and enterprise-grade analytics dashboard.

---

# Phase 1 – Understand the Business Requirements

Before making any changes, carefully review and understand every business rule and requirement described below.

Do **not** make assumptions.

Ensure every dashboard calculation, classification, visualization, and interaction follows these requirements exactly.

---

# Phase 2 – Validate the Source Data

## Dashboard Classification Rules

### Data Analytics

#### *Activation*

**Not Activated**

* Enrollment Activated \= No

* LMS Course Status \= In Progress

**Activated**

* Enrollment Activated \= Yes

* LMS Course Status \= Validated

#### *Performance*

**Lagging Behind**

* Learner has only 1–2 submissions

* eHub Class Name is one of:

  * WALX\_C\#1

  * DA-1\_rolling

  * DA-2\_rolling

**On Track**

* Learner has at least 3 submissions

* eHub Class Name \= DA-3\_rolling

---

### Cyber Security

#### *Activation*

**Not Activated**

* LMS Overall Score \= 0

**Activated**

* LMS Overall Score \> 0

#### *Performance*

**Lagging Behind**

* LMS Overall Score is between 1 and 50

**On Track**

* LMS Overall Score \> 50

---

# Phase 3 – Validate the Source Data Structure

The workbook contains separate datasets for **Data Analytics** and **Cyber Security**.

Each program contains three worksheets.

## Data Analytics

### Sheet 1 – Exported from Tracker (DA)

Contains the complete learner export from the ALX Learner Management Tracker.

### Sheet 2 – UN All Registered Data Analytics

Contains the original list of all learners registered under the UN Women Data Analytics program.

### Sheet 3 – selected\_data\_elements\_for\_visualization

Contains the cleaned and validated dataset created by cross-checking the tracker export against the original registration list. This sheet contains only the fields required for dashboard calculations, KPIs, filtering, and visualizations.

---

## Cyber Security

### Sheet 1 – Exported from Tracker (CS)

Contains the complete learner export from the ALX Learner Management Tracker.

### Sheet 2 – UN All Registered Cyber Security

Contains the original list of all learners registered under the UN Women Cyber Security program.

### Sheet 3 – selected\_data\_elements\_for\_visualization

Contains the cleaned and validated dataset created by cross-checking the tracker export against the original registration list. This sheet contains only the fields required for dashboard calculations, KPIs, filtering, and visualizations.

---

## Validate the Data

Perform a complete validation of the datasets by:

* Verifying the matching logic between worksheets.

* Confirming every registered learner is correctly matched.

* Identifying learners missing from either dataset.

* Detecting duplicate records.

* Identifying incorrect matches.

* Identifying inconsistent values.

* Detecting missing LMS records.

* Validating calculated fields.

* Reviewing data quality.

* Ensuring the visualization datasets contain accurate, complete, and calculation-ready data.

Provide recommendations for improving the data preparation process.

---

# Phase 4 – Validate Every Dashboard Metric

Cross-check every dashboard metric against the validated data.

For every KPI, chart, summary card, percentage, table, and metric:

* Verify the calculation logic.

* Recalculate values directly from the source data.

* Compare calculated values against the dashboard.

* Identify discrepancies.

* Explain the root cause.

* Recommend the correct calculation.

* Provide corrected values.

Generate a detailed validation report containing:

* Dashboard value

* Correct value

* Difference

* Root cause

* Recommended fix

* Expected result

---

# Phase 5 – Update Business Logic

Update every dashboard component to follow the revised learner journey.

## Executive Summary

Update to:

**UN Sponsored Seats → LMS Onboarded → Activated → On Track**

If useful, also include:

* Not Activated

* Lagging Behind

Ensure all values are dynamically calculated.

---

## Learner Directory & Action Matrix

Review and improve the following columns:

* Track

* Contact Information

* LMS Score

* Health Status

* Activation Status

* Last Active

Rename columns where necessary to improve clarity and consistency.

---

## Health Classification

Replace the existing categories:

* Healthy

* Support

* At Risk

* Inactive

with:

### Activation

* Not Activated

* Activated

### Performance

* Lagging Behind

* On Track

Ensure all learners are classified according to the business rules.

---

## Update the Following Dashboard Sections

Ensure every calculation and visualization reflects the updated business logic.

Update:

* Executive Summary

* Learner Journey Funnel

* Health Taxonomy Breakdown

* Learner Directory

* Action Matrix

* Health Classification Methodology

---

# Phase 6 – Data Cleaning

During processing:

* Remove leading and trailing spaces from email addresses.

* Remove duplicate records.

* Normalize inconsistent values.

* Handle null values appropriately.

* Standardize formatting.

* Validate unique identifiers.

* Ensure reliable matching across datasets.

Pay particular attention to whitespace in email addresses, as it may impact matching.

---

# Phase 7 – UI & Visual Design Review

Perform a comprehensive visual audit.

Review:

* Overall layout

* Grid system

* Alignment

* Spacing

* Typography

* Color palette

* Buttons

* Cards

* Icons

* Borders

* Shadows

* Visual hierarchy

* Component consistency

Identify:

* Outdated UI

* Misaligned elements

* Inconsistent spacing

* Visual clutter

* Redundant components

* Poor readability

* Low contrast

* Unnecessary design elements

Recommend a cleaner, more modern, enterprise-grade design.

---

# Phase 8 – Dashboard & Data Visualization Review

Review every visualization.

Evaluate:

* KPI cards

* Charts

* Tables

* Funnels

* Progress indicators

* Legends

* Labels

* Tooltips

* Filters

Determine whether:

* The visualization accurately represents the data.

* The chart type is appropriate.

* Information is easy to understand.

* Metrics are actionable.

* Context is sufficient.

Recommend:

* Better chart types.

* Improved layouts.

* Better labels.

* Better grouping.

* Additional context where necessary.

* Removal of redundant metrics.

---

# Phase 9 – UX & Usability Review

Evaluate the user experience.

Review:

* Navigation

* Filtering

* Search

* Interactions

* Responsiveness

* Accessibility

* Loading states

* Error states

* User flows

* Information discoverability

Determine whether:

* First-time users understand the dashboard quickly.

* Common tasks are efficient.

* Navigation is intuitive.

* Users experience cognitive overload.

Recommend improvements to simplify and streamline the experience.

---

# Phase 10 – Information Architecture

Review the overall page structure.

Assess:

* Content hierarchy

* Information grouping

* Section ordering

* Navigation flow

* Visual prioritization

Recommend:

* Better grouping of related information.

* Removal of unnecessary sections.

* Improved layout hierarchy.

* Progressive disclosure where appropriate.

---

# Phase 11 – Accessibility & Performance

Evaluate:

* Color contrast

* Keyboard accessibility

* Focus states

* Responsive behavior

* Screen reader compatibility

* Rendering performance

* Scalability

* Component reusability

* Dashboard responsiveness

* Data refresh performance

Recommend improvements aligned with modern accessibility and performance standards.

---

# Phase 12 – Admin Features

Implement a simple Admin Login.

Requirements:

* Static username and password.

* Credentials shared only with administrators.

* Access restricted to dashboard management functions.

* No complex authentication required.

---

# Phase 13 – Data Upload & Storage

Design and document the data update workflow.

Clearly define:

* Where uploaded CSV/Excel files are stored.

* Whether uploads append, replace, or merge data.

* Duplicate handling.

* Historical data preservation.

* Validation before import.

* Automatic recalculation of metrics.

* Dashboard refresh process.

* Error handling and rollback strategy.

Ensure the workflow is reliable, predictable, and easy for administrators to use.

---

# Phase 14 – Final Deliverables

Produce a comprehensive implementation report containing:

## Data Validation

* Complete validation report.

* Corrected calculations.

* Data quality findings.

* Matching issues.

* Data cleaning recommendations.

## Dashboard Audit

* UI review.

* UX review.

* Information architecture review.

* Data visualization review.

* Accessibility review.

* Performance review.

## Dashboard Redesign

Provide:

* Recommended page structure.

* Improved layout.

* Better KPI organization.

* Improved navigation.

* Enhanced visualization hierarchy.

* Cleaner user flows.

* Suggested wireframe-level layout changes.

## Feature Recommendations

Identify valuable enhancements such as:

* Advanced filters

* Global search

* Drill-down capabilities

* Export options

* Date range filters

* Saved views

* Trend analysis

* Alerts

* Data freshness indicators

* Role-based access

* Audit logs

* Activity history

Only recommend features that provide clear value.

## Actionable Recommendations

For every issue identified, include:

* Issue description

* Why it matters

* User impact

* Recommended solution

* Implementation approach

* Expected outcome

* Priority:

  * Critical

  * High

  * Medium

  * Low

## Prioritized Implementation Roadmap

Organize all work into four phases:

### Phase 1 – Critical Fixes

* Data accuracy

* Business logic

* Calculation errors

* Broken functionality

### Phase 2 – High Priority

* Dashboard redesign

* UX improvements

* Visualization enhancements

* Performance optimization
