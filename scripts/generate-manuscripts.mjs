// Deterministic synthetic manuscript benchmark generator.
//
// Ten manuscript-shaped markdown reports. Every author, institution, award,
// registry identifier and data value is fictional. The expected labels are
// assigned here, from the construction of each manuscript, and this script
// does not import dsh-manuscript-check or read its output: a label is never
// fitted to the detector.
//
// The label space is the plugin's `manuscript` guideline:
//   title abstract introduction methods results discussion conclusion ethics
//   consent funding conflicts data contributions registration
// and the document-level core-section set is
//   abstract introduction methods results discussion.
//
// Coverage: complete CONSORT-style trial, missing ethics/consent, missing data
// availability, missing randomization/registration, missing abstract, missing
// statistical methods, STROBE-style cohort, PRISMA-style review, a plain-text
// title without markdown `#`, and a mixed Chinese-English title.
//
// The dataset is synthetic and frozen: no timestamps, no randomness, and two
// runs write byte-identical files.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'data', 'manuscripts')
mkdirSync(outDir, { recursive: true })

const VERSION = '0.1.0'
const TOTAL_CASES = 10

const ITEM_IDS = [
  'title',
  'abstract',
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'ethics',
  'consent',
  'funding',
  'conflicts',
  'data',
  'contributions',
  'registration',
]

const CORE_SECTIONS = ['abstract', 'introduction', 'methods', 'results', 'discussion']

const CATEGORIES = [
  'complete-consort',
  'missing-ethics-consent',
  'missing-data-availability',
  'missing-randomization',
  'missing-abstract',
  'missing-statistical-methods',
  'strobe-cohort',
  'prisma-review',
  'plain-text-title',
  'mixed-language-title',
]

const TAG_SPACE = [
  'all-items-present',
  'cohort',
  'complete',
  'consort',
  'content-complete',
  'controlled-trial',
  'discourse-summary',
  'meta-analysis',
  'missing-abstract',
  'missing-consent',
  'missing-data-availability',
  'missing-ethics',
  'missing-randomization',
  'missing-registration',
  'missing-statistical-methods',
  'mixed-language-title',
  'no-markdown',
  'paraphrased-declarations',
  'pilot-study',
  'plain-title',
  'prisma',
  'randomized-trial',
  'strobe',
  'systematic-review',
]

/** Strip the two-space source indentation from a manuscript template. */
const manuscript = text => text.replace(/^ {2}/gmu, '').trim()

/** Build the 14 expected item labels; every item defaults to present. */
const labelItems = missing => {
  for (const id of missing) {
    if (!ITEM_IDS.includes(id)) throw new Error(`unknown item id ${id}`)
  }
  if (new Set(missing).size !== missing.length) throw new Error('duplicate missing item')
  return Object.fromEntries(ITEM_IDS.map(id => [id, missing.includes(id) ? 'missing' : 'present']))
}

const cases = [
  {
    id: 'ms-0001',
    category: 'complete-consort',
    description:
      'Complete CONSORT-style randomized trial: every one of the 14 checklist items is stated, including the seven declarations and a fictional trial registration.',
    tags: ['consort', 'randomized-trial', 'complete'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Early Mobility Coaching After Elective Knee Replacement: A Randomized Controlled Trial

  Avery L. Quinton, Mira T. Solberg, Devin R. Halloway

  ## Abstract

  Background: Early mobilisation after elective knee replacement may shorten hospital stay, but coached programmes are inconsistently delivered. Methods: We conducted a two-arm, parallel-group randomized controlled trial in 184 adults scheduled for elective knee replacement at Northlake University Hospital. Participants received either a structured early-mobility coaching programme or usual postoperative care. The primary outcome was time to independent walking. Results: The coaching group walked independently 9.4 hours earlier on average (95% confidence interval 5.1 to 13.7). Secondary outcomes favoured coaching, with no increase in adverse events. Conclusions: Early mobility coaching improved recovery milestones without compromising safety.

  ## Introduction

  Delayed mobilisation is common after knee replacement and is associated with longer stays and slower functional recovery. Previous small studies suggest that daily coaching may help, but most were single-centre and unblinded. We therefore tested whether a structured coaching programme would shorten the time to independent walking compared with usual care. Our objective was to estimate the effect on that prespecified primary outcome and on selected secondary outcomes.

  ## Methods

  ### Trial design and participants

  This was a two-arm, parallel-group randomized controlled trial conducted at two community hospitals in the Northlake region between March and November 2024. Eligible participants were adults aged 45 to 80 years scheduled for unilateral elective knee replacement. We excluded people with an active infection, a previous stroke with mobility limitation, or a planned discharge to a nursing facility.

  ### Interventions

  The coaching group received a daily 30-minute session with a mobility coach, a written exercise plan, and a goal sheet. The control group received usual postoperative physiotherapy. Both groups followed the same hospital mobilisation safety rules.

  ### Outcomes

  The primary outcome was time from surgery to independent walking for 20 metres without assistance. Secondary outcomes were length of stay, walking distance at discharge, and adverse events.

  ### Sample size, randomization, and blinding

  We planned a sample of 180 participants to detect a 6-hour difference in the primary outcome with 90% power at a two-sided alpha of 0.05. Randomization used a computer-generated sequence in permuted blocks of six, stratified by site. Allocation was concealed in sequentially numbered opaque envelopes. Outcome assessors were blinded to group assignment; participants and coaches were not.

  ### Statistical methods

  The primary analysis followed the intention-to-treat principle. We used a linear mixed model with site as a random intercept and reported mean differences with 95% confidence intervals. Secondary outcomes used the same framework. A per-protocol analysis was prespecified as a sensitivity analysis.

  ## Results

  Of 212 people assessed for eligibility, 184 were randomly assigned: 92 to coaching and 92 to usual care. Baseline characteristics were similar, including mean age (64.1 vs 63.7 years) and baseline walking status. All participants received their allocated treatment.

  The coaching group walked independently after a mean of 31.2 hours, compared with 40.6 hours in the usual-care group, a difference of -9.4 hours (95% confidence interval -13.7 to -5.1; p < 0.001). Mean length of stay was 1.8 days shorter with coaching. Walking distance at discharge was greater in the coaching group. Adverse events were similar between groups (7 vs 8 participants), and no serious event was judged related to the programme.

  ## Discussion

  In this trial, structured early-mobility coaching accelerated independent walking and shortened hospital stay. The effect was consistent across sites and in the per-protocol analysis. Our findings extend earlier single-centre reports and suggest that a low-cost coaching role can be integrated into routine care.

  Several limitations deserve attention. Participants and coaches could not be blinded, so performance bias is possible. The follow-up ended at discharge, and we did not measure function beyond 30 days. The trial was conducted in two hospitals with established mobility pathways, which may limit generalisability.

  ## Conclusion

  Early mobility coaching after elective knee replacement shortened the time to independent walking and reduced length of stay without increasing adverse events. A larger multicentre trial with longer follow-up should test whether these gains persist.

  ## Declarations

  **Ethics approval.** The Northlake University Research Ethics Committee approved the study (approval SYN-ETH-2024-031).

  **Consent.** All participants provided written informed consent before enrolment.

  **Funding.** This work was supported by the Northlake Innovation Fund (award SYN-2024-017).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Data availability.** The de-identified dataset and analysis code are available from the corresponding author on reasonable request.

  **Author contributions.** A.L.Q. designed the trial and drafted the manuscript. M.T.S. coordinated recruitment and data collection. D.R.H. performed the statistical analysis. All authors revised and approved the final manuscript.

  **Registration.** The trial was prospectively registered in a fictional registry (SYNTH-2024-001).
  `),
  },
  {
    id: 'ms-0002',
    category: 'missing-ethics-consent',
    description:
      'Randomized community trial with no ethics approval or informed-consent statement; both are labelled missing while the other 12 items are present.',
    tags: ['randomized-trial', 'missing-ethics', 'missing-consent'],
    missing: ['ethics', 'consent'],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Peer-Led Walking Groups for Adults With Stable Angina: A Randomized Trial

  Nadia P. Corren, Elias W. Mercer, June K. Alder

  ## Abstract

  Background: Supervised walking improves exercise capacity in stable angina, but peer-led community programmes are less well studied. Methods: We randomized 148 adults with stable angina to a 12-week peer-led walking group or a self-directed walking leaflet. The primary outcome was six-minute walk distance at 12 weeks. Results: The peer-led group walked 38 metres farther on average (95% confidence interval 21 to 55). Secondary outcomes also favoured the programme. Conclusions: Peer-led walking groups improved exercise capacity in this community sample.

  ## Introduction

  Regular walking is a core component of cardiac rehabilitation, yet uptake of centre-based programmes is low. Peer-led groups may reach people who decline formal rehabilitation, but evidence from community settings is limited. We evaluated whether a 12-week peer-led walking group would improve six-minute walk distance compared with a self-directed leaflet. We also assessed attendance, walking confidence, and adverse events.

  ## Methods

  ### Design and participants

  This was a two-arm randomized trial in four community health centres in the Northlake region. Adults aged 40 to 75 years with stable angina and no recent acute coronary syndrome were eligible. We excluded people who could not walk unaided, had severe aortic stenosis, or were already attending supervised rehabilitation.

  ### Intervention

  Participants allocated to the peer-led group attended two walks per week led by a trained peer. Each walk lasted 45 minutes and included a warm-up, a moderate-intensity walk, and a cool-down. The comparison group received a printed self-directed walking plan and one telephone call.

  ### Outcomes and follow-up

  The primary outcome was six-minute walk distance at 12 weeks, measured by an assessor who was unaware of allocation. Secondary outcomes included attendance, the Exercise Self-Efficacy Scale, and adverse events. Follow-up visits took place at the community centre or by home visit.

  ### Sample size and randomization

  We planned 148 participants to detect a 30-metre difference with 80% power at alpha 0.05. Randomization used a computer-generated sequence with permuted blocks of four, stratified by centre. Allocation was concealed in sealed envelopes. Participants and peer leaders could not be blinded; outcome assessors were blinded.

  ### Statistical methods

  The primary comparison used a linear regression model adjusted for centre and baseline distance. We report mean differences with 95% confidence intervals. Missing outcome data were handled with multiple imputation, and a complete-case analysis was prespecified as a sensitivity analysis.

  ## Results

  Of 176 people screened, 148 were randomized: 74 to peer-led walking and 74 to the leaflet. Baseline characteristics were balanced. Mean age was 61.8 years, and 46% of participants were women.

  At 12 weeks, the peer-led group walked 412 metres on average, compared with 374 metres in the leaflet group, a difference of 38 metres (95% confidence interval 21 to 55; p < 0.001). Attendance averaged 17 of 24 walks. Self-efficacy scores improved more in the peer-led group. Twelve adverse events occurred, all musculoskeletal and none serious.

  ## Discussion

  The peer-led programme produced a clinically modest but consistent improvement in walking distance. The effect was larger among participants who attended at least 16 walks. Our findings suggest that trained peers can deliver a safe walking programme in community settings.

  The trial has limitations. Participants were not blinded, and the 12-week follow-up does not show whether gains persist. The leaflet group also received a telephone call, which may have raised usual-care performance. Finally, the sample was drawn from four centres in one region.

  ## Conclusion

  A 12-week peer-led walking group improved six-minute walk distance in adults with stable angina. Future work should test longer-term maintenance and cost-effectiveness.

  ## Declarations

  **Funding.** This work was supported by the Northlake Community Health Fund (award SYN-2024-024).

  **Conflicts of interest.** The authors declare no competing interests.

  **Data availability.** The de-identified dataset and analysis code are available from the corresponding author on reasonable request.

  **Author contributions.** N.P.C. designed the trial and drafted the manuscript. E.W.M. led recruitment and data collection. J.K.A. performed the statistical analysis. All authors revised and approved the final manuscript.

  **Registration.** The trial was registered in a fictional registry (SYNTH-2024-002).
  `),
  },
  {
    id: 'ms-0003',
    category: 'missing-data-availability',
    description:
      'Prospective cohort with no data-availability statement; the other 13 items, including ethics, consent and registration, are present.',
    tags: ['cohort', 'missing-data-availability'],
    missing: ['data'],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Sleep Timing and Glycaemic Variability in Adults With Type 2 Diabetes: A Prospective Cohort Study

  Marta S. Iven, Owen T. Rusk, Priya N. Calder

  ## Abstract

  Background: Irregular sleep timing may worsen glucose control, but prospective evidence is limited. Methods: We followed 212 adults with type 2 diabetes for 12 months and measured sleep timing with wrist actigraphy and glycaemic variability with continuous glucose monitoring. Results: Later and more variable sleep timing was associated with higher glycaemic variability after adjustment. Conclusions: Sleep regularity may be a modifiable target for glycaemic control.

  ## Introduction

  Glycaemic variability predicts complications in type 2 diabetes, and sleep is increasingly recognised as a contributor to glucose regulation. Cross-sectional studies report associations between short sleep and higher HbA1c, but few have measured sleep timing prospectively. We examined whether sleep timing and its night-to-night variability were associated with glycaemic variability over 12 months.

  ## Methods

  ### Design and setting

  We conducted a prospective cohort study in three primary care networks in the Northlake region. Participants were recruited from diabetes registers between January and June 2024.

  ### Participants

  Eligible adults were aged 30 to 75 years with a clinical diagnosis of type 2 diabetes for at least one year. We excluded people with rotating night-shift work, untreated sleep apnoea, or pregnancy.

  ### Measurements

  Participants wore a wrist actigraph for 14 consecutive days at baseline and at 12 months. Sleep timing was summarised as the midpoint of the sleep episode on free days. Continuous glucose monitoring was worn for 10 days at each measurement point. Glycaemic variability was defined as the coefficient of variation of sensor glucose. Covariates included age, sex, diabetes duration, body mass index, and insulin use.

  ### Statistical methods

  We used multivariable linear regression with generalised estimating equations to account for repeated measures within participants. Sleep midpoint and sleep-timing variability were modelled continuously and in quartiles. We adjusted for the prespecified covariates and tested for interaction by insulin use.

  ## Results

  Of 248 people invited, 212 joined the cohort and 198 completed both measurement points. Mean age was 58.4 years, 47% were women, and mean diabetes duration was 9.2 years. Mean sleep midpoint was 03:12, and mean sleep-timing variability was 48 minutes.

  Each one-hour later sleep midpoint was associated with a 1.4 percentage-point higher coefficient of variation (95% confidence interval 0.6 to 2.2). Each 30-minute increase in sleep-timing variability was associated with a 0.9 percentage-point increase (95% confidence interval 0.3 to 1.5). Associations were similar after adjustment and did not differ by insulin use.

  ## Discussion

  In this prospective cohort, later and more variable sleep timing was associated with higher glycaemic variability. The findings are consistent with experimental work linking circadian disruption to insulin resistance. If confirmed, sleep regularity could become a practical target alongside diet and medication.

  The study has limitations. Actigraphy estimates sleep timing from movement and can misclassify quiet wakefulness. Continuous glucose monitoring captures interstitial rather than plasma glucose. Participants were mostly white and had established diabetes, which limits generalisability.

  ## Conclusion

  Sleep timing and night-to-night variability were associated with glycaemic variability in adults with type 2 diabetes. Interventional studies should test whether stabilising sleep timing improves glucose control.

  ## Declarations

  **Ethics approval.** The Northlake Regional Ethics Board approved the cohort (approval SYN-ETH-2024-052).

  **Consent.** All participants provided written informed consent.

  **Funding.** This study was funded by the Northlake Metabolic Research Fund (award SYN-2024-028).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Author contributions.** M.S.I. designed the cohort and drafted the manuscript. O.T.R. coordinated actigraphy and glucose monitoring. P.N.C. performed the statistical analysis. All authors revised and approved the final manuscript.

  **Registration.** The cohort was registered in a fictional study registry (SYNTH-2024-003).
  `),
  },
  {
    id: 'ms-0004',
    category: 'missing-randomization',
    description:
      'Controlled trial whose methods omit randomization and allocation details, and that reports no trial or protocol registration; registration is labelled missing.',
    tags: ['controlled-trial', 'missing-randomization', 'missing-registration'],
    missing: ['registration'],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # A Controlled Trial of Nurse-Led Medication Review After Discharge

  Colin H. Voss, Renee A. Minter, Tobias J. Grey

  ## Abstract

  Background: Medication errors are common after hospital discharge. Methods: We compared a nurse-led medication review with usual discharge care in 160 adults leaving two community hospitals. The primary outcome was the proportion with at least one medication discrepancy at 14 days. Results: The review group had fewer discrepancies, and the difference persisted at 30 days. Conclusions: A nurse-led review reduced medication discrepancies after discharge.

  ## Introduction

  Transitions from hospital to home are a high-risk period for medication error. Pharmacist-led reviews are effective in some settings, but access is limited in community hospitals. We tested a nurse-led review delivered before discharge and repeated by telephone one week later.

  ## Methods

  ### Design and participants

  This was a two-arm, parallel-group controlled trial in two community hospitals in the Northlake region. Eligible participants were adults aged 50 years or older discharged with at least four regular medicines. We excluded people discharged to residential care or with a planned readmission within 14 days.

  ### Intervention

  The intervention group received a structured review by a trained nurse before discharge and a follow-up telephone call at seven days. The nurse reconciled the discharge list with the pre-admission list, checked doses and interactions, and sent a summary to the community pharmacy. The comparison group received the hospital's usual discharge medication list and standard counselling.

  ### Outcomes

  The primary outcome was the proportion of participants with at least one medication discrepancy at 14 days, assessed by a pharmacist who was unaware of group assignment. Secondary outcomes were discrepancies at 30 days, readmission, and adverse drug events.

  ### Sample size and analysis

  We planned 160 participants to detect a reduction from 40% to 22% with 80% power at alpha 0.05. Participants were assigned to groups by the central coordinating office in alternating blocks by site. The primary analysis compared proportions with a chi-square test, and we report risk differences with 95% confidence intervals.

  ## Results

  Of 191 people screened, 160 were enrolled and assigned: 80 to nurse-led review and 80 to usual care. The groups were similar at baseline. Mean age was 67.3 years, and 52% were women.

  At 14 days, 21 participants (26%) in the review group had at least one discrepancy, compared with 38 (48%) in the usual-care group, a risk difference of -22 percentage points (95% confidence interval -36 to -8; p = 0.004). At 30 days, the difference was smaller but still present. Readmissions and adverse drug events did not differ materially.

  ## Discussion

  A nurse-led medication review reduced discrepancies after discharge in two community hospitals. The intervention was brief and used existing nursing staff, which may make it easier to adopt than pharmacist-led models. The persistence of the effect at 30 days suggests that the telephone follow-up added value.

  Limitations include the lack of participant blinding, the short follow-up, and the use of a single pharmacist assessor. The alternating assignment by site may have introduced confounding if sites differed in usual care. We could not assess whether fewer discrepancies translated into fewer harms.

  ## Conclusion

  A nurse-led medication review before discharge, with a telephone follow-up, reduced medication discrepancies in older adults. A larger trial should test clinical outcomes and cost.

  ## Declarations

  **Ethics approval.** The Northlake Community Research Ethics Committee approved the trial (approval SYN-ETH-2024-061).

  **Consent.** All participants provided written informed consent.

  **Funding.** This work was supported by the Northlake Patient Safety Fund (award SYN-2024-033).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Data availability.** The de-identified dataset is available from the corresponding author on reasonable request.

  **Author contributions.** C.H.V. designed the trial and drafted the manuscript. R.A.M. delivered the intervention and collected data. T.J.G. performed the statistical analysis. All authors revised and approved the final manuscript.
  `),
  },
  {
    id: 'ms-0005',
    category: 'missing-abstract',
    description:
      'Field study with no abstract section; the phrase "In summary" appears only as a discourse marker in the discussion.',
    tags: ['missing-abstract', 'discourse-summary'],
    missing: ['abstract'],
    coreSections: CORE_SECTIONS.filter(section => section !== 'abstract'),
    text: manuscript(`
  # Workplace Standing Desks and Lower-Back Discomfort: A Pragmatic Field Study

  Helena R. Sloane, Marcus E. Tull, Anika P. Reyes

  ## Introduction

  Office workers who sit for long periods often report lower-back discomfort. Standing desks are widely marketed, but evidence from routine workplaces is mixed. We evaluated whether providing a height-adjustable standing desk reduced discomfort over six months in a municipal office.

  ## Methods

  ### Setting and participants

  The study took place in a single municipal office in the Northlake region. Employees aged 21 to 62 years who used a computer for at least six hours per day were invited. We excluded employees with a current injury, recent spinal surgery, or a planned move to another office.

  ### Design

  We used a pragmatic field design with a stepped introduction of standing desks by floor. Floor A received desks at the start of the study; floor B received desks after three months. All participants continued their usual work tasks.

  ### Outcomes

  The primary outcome was lower-back discomfort on a 0 to 10 numeric rating scale, recorded weekly. Secondary outcomes were sitting time, standing time, and self-reported productivity. Measurements were collected through a short weekly survey and a desk sensor.

  ### Analysis

  We compared weekly discomfort scores between floors using a difference-in-differences model with participant-level random intercepts. We adjusted for baseline discomfort, age, and sex. We also summarised sitting and standing time descriptively.

  ## Results

  Sixty-two employees joined the study, and 58 completed six months. Mean age was 41.7 years, and 55% were women. Baseline discomfort was similar between floors.

  After the desks were introduced, the intervention floor reported lower discomfort than the comparison floor. The adjusted difference was -0.8 points (95% confidence interval -1.4 to -0.2). Sitting time fell by 42 minutes per workday, and standing time rose by 35 minutes. Productivity scores did not change materially.

  ## Discussion

  Providing standing desks was associated with a modest reduction in lower-back discomfort and a shift from sitting to standing. The effect is smaller than those reported in controlled laboratory studies, which may reflect imperfect adherence and the short duration of desk use.

  Limitations include the small sample, the non-random introduction by floor, and the self-reported primary outcome. The sensor measured desk height rather than actual posture. The study was conducted in one office, so the findings may not generalise to other workplaces.

  In summary, standing desks may provide a small benefit for office workers with lower-back discomfort, but the effect is not large enough to replace other ergonomic measures.

  ## Conclusion

  A standing-desk programme reduced sitting time and modestly improved lower-back discomfort in a municipal office. Larger randomised studies with objective posture measures are needed.

  ## Declarations

  **Ethics approval.** The Northlake University Research Ethics Committee approved the field study (approval SYN-ETH-2024-077).

  **Consent.** All participants provided written informed consent.

  **Funding.** This work was supported by the Northlake Workplace Health Fund (award SYN-2024-041).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Data availability.** The de-identified survey data are available from the corresponding author on reasonable request.

  **Author contributions.** H.R.S. designed the study and drafted the manuscript. M.E.T. installed the desks and collected sensor data. A.P.R. performed the statistical analysis. All authors revised and approved the final manuscript.

  **Registration.** The study was registered in a fictional registry (SYNTH-2024-005).
  `),
  },
  {
    id: 'ms-0006',
    category: 'missing-statistical-methods',
    description:
      'Pilot study with a Methods section but no statistical methods or analysis plan; all 14 checklist items are present because the guideline has no statistics item.',
    tags: ['pilot-study', 'missing-statistical-methods', 'all-items-present'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Text Message Reminders for Clinic Attendance: A Pilot Study

  Bianca T. Ostrand, Felix M. Rourke, Sima L. Danes

  ## Abstract

  Background: Missed appointments disrupt continuity of care. Methods: We piloted a two-arm text message reminder programme in one urban clinic and compared attendance over eight weeks. Results: The reminder group attended more scheduled visits than the usual-care group. Conclusions: Text reminders are feasible and may improve attendance.

  ## Introduction

  Missed clinic appointments waste staff time and can delay care. Text message reminders are inexpensive, but evidence from small community clinics is limited. We conducted a pilot study to estimate attendance and to assess whether a full trial would be feasible.

  ## Methods

  ### Setting and participants

  The pilot took place in a single community clinic in the Northlake region. Adults with at least one scheduled follow-up visit during the eight-week study period were eligible. We excluded people without a mobile phone or who asked not to be contacted.

  ### Intervention

  Participants in the reminder group received a text message 48 hours before each appointment and a second message on the morning of the visit. The messages stated the date, time, and clinic address, and offered a reply option to reschedule. The usual-care group received the clinic's standard paper reminder.

  ### Outcomes

  The primary outcome was the proportion of scheduled visits attended during the study period. Secondary outcomes were rescheduling, cancellations, and participant satisfaction. Attendance was recorded by the clinic reception system.

  ### Procedures

  Participants were allocated to groups by the clinic manager using a list generated before recruitment. Staff recorded attendance at each visit. The pilot was intended to estimate recruitment, retention, and attendance rates for a larger study.

  ## Results

  Forty-eight adults joined the pilot: 24 in the reminder group and 24 in the usual-care group. The groups were similar in age and number of scheduled visits. Mean age was 49.6 years, and 60% were women.

  The reminder group attended 71 of 92 scheduled visits (77%), compared with 58 of 90 visits (64%) in the usual-care group. Four participants in the reminder group rescheduled at least one visit, compared with two in the usual-care group. Satisfaction was high in both groups. No participant withdrew.

  ## Discussion

  The pilot met its feasibility targets: recruitment was completed in three weeks, retention was complete, and the text messages were delivered as planned. Attendance was higher in the reminder group, but the small sample and the absence of formal testing mean that the difference is imprecise.

  Limitations include the single clinic, the short duration, and the use of a list generated by the clinic manager rather than a concealed allocation system. The pilot was not designed to detect a statistically significant difference. The attendance difference may reflect seasonal variation or differences in visit types.

  ## Conclusion

  A text message reminder programme was feasible in a community clinic and was associated with higher attendance. A larger trial with concealed allocation and a prespecified analysis plan is warranted.

  ## Declarations

  **Ethics approval.** The Northlake Community Ethics Committee approved the pilot (approval SYN-ETH-2024-088).

  **Consent.** All participants provided written informed consent.

  **Funding.** This work was supported by the Northlake Access to Care Fund (award SYN-2024-047).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Data availability.** The de-identified attendance data are available from the corresponding author on reasonable request.

  **Author contributions.** B.T.O. designed the pilot and drafted the manuscript. F.M.R. coordinated the clinic and collected attendance data. S.L.D. reviewed the protocol and edited the manuscript. All authors revised and approved the final manuscript.

  **Registration.** The pilot was registered in a fictional registry (SYNTH-2024-006).
  `),
  },
  {
    id: 'ms-0007',
    category: 'strobe-cohort',
    description:
      'Content-complete STROBE-style cohort; declarations are worded as "supported by", "competing financial interests", "dataset deposited" and a roles line.',
    tags: ['strobe', 'cohort', 'content-complete', 'paraphrased-declarations'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Long-Term Shift Work and Incident Hypertension: A Prospective Cohort Study

  Ravi K. Menon, Clara J. Boone, Stefan A. Wick

  ## Abstract

  Background: Shift work disrupts circadian rhythms and may raise blood pressure. Methods: We followed 1,240 hospital employees without hypertension for six years and estimated the association between shift-work exposure and incident hypertension. Results: Cumulative night-shift work was associated with a higher incidence of hypertension after adjustment. Conclusions: Limiting long-term night-shift exposure may support blood-pressure prevention.

  ## Introduction

  Hypertension is a leading modifiable risk factor for cardiovascular disease. Shift work affects sleep, physical activity, and diet, and has been linked to raised blood pressure in cross-sectional studies. Prospective evidence with detailed exposure assessment is limited. We examined whether cumulative night-shift work predicted incident hypertension in a cohort of hospital employees.

  ## Methods

  ### Study design and setting

  We conducted a prospective cohort study among employees of three hospitals in the Northlake region. Recruitment took place between 2018 and 2019, and follow-up continued for six years.

  ### Participants

  Eligible employees were aged 20 to 65 years and worked at least 20 hours per week. We excluded people with prevalent hypertension, cardiovascular disease, or kidney disease at baseline, and those with fewer than two blood-pressure measurements during follow-up.

  ### Exposure and outcomes

  Shift-work exposure was collected from payroll records and annual questionnaires. Cumulative night-shift work was calculated as the total number of night shifts worked before each visit. The primary outcome was incident hypertension, defined as a systolic blood pressure of at least 140 mmHg, a diastolic pressure of at least 90 mmHg, or initiation of antihypertensive medication. Blood pressure was measured by trained nurses using a standard protocol.

  ### Covariates and statistical methods

  Covariates included age, sex, body mass index, smoking, alcohol intake, physical activity, and family history of hypertension. We used Cox proportional hazards regression with time-varying shift-work exposure, adjusted for the prespecified covariates. We tested for interaction by sex and conducted a sensitivity analysis restricted to participants with at least five blood-pressure measurements.

  ## Results

  Of 1,512 employees screened, 1,240 joined the cohort. Mean age was 42.3 years, 61% were women, and 35% worked night shifts at baseline. During 6,840 person-years of follow-up, 186 participants developed hypertension.

  Each additional 500 night shifts was associated with a hazard ratio of 1.12 (95% confidence interval 1.05 to 1.19) after adjustment. The association was stronger among participants younger than 45 years, but the interaction test was not statistically significant. Results were similar in the sensitivity analysis.

  ## Discussion

  In this prospective cohort, cumulative night-shift work was associated with a modest increase in the hazard of hypertension. The dose-response pattern and the persistence after adjustment for lifestyle factors support a plausible effect of circadian disruption. The finding is relevant to hospitals that rely on long-term night shifts.

  The study has limitations. Shift-work exposure came from payroll records, which may miss informal shift swaps. Blood pressure was measured at occupational health visits rather than by ambulatory monitoring. Participants were hospital employees, and most were white, which may limit generalisability.

  ## Conclusion

  Cumulative night-shift work was associated with incident hypertension in a hospital cohort. Organisational strategies that limit prolonged night-shift exposure deserve evaluation in controlled studies.

  ## Declarations

  **Ethics.** The study was approved by the Northlake Research Ethics Committee (reference SYN-ETH-2024-044).

  **Consent.** Participants provided written informed consent at baseline.

  **Support.** This study was supported by the Northlake Prevention Fund (award SYN-2024-022).

  **Declarations.** The authors have no competing financial interests to declare.

  **Dataset.** The de-identified dataset is deposited in the SYNTH repository (accession SYN-DATA-0007).

  **Roles.** R.K.M. and C.J.B. designed the study; S.A.W. analysed the data; all authors approved the final manuscript.

  **Registration.** The study protocol was registered before recruitment (fictional registry SYN-2024-009).
  `),
  },
  {
    id: 'ms-0008',
    category: 'prisma-review',
    description:
      'PRISMA-style systematic review and meta-analysis with all 14 items, including a fictional PROSPERO record and a not-required ethics/consent statement.',
    tags: ['prisma', 'systematic-review', 'meta-analysis'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # Walking Speed and Falls in Older Adults: A Systematic Review and Meta-Analysis

  Talia F. Nord, Henrik O. Salm, Yuki R. Tan

  ## Abstract

  Background: Slow walking speed is a candidate marker of fall risk, but estimates vary. Methods: We systematically reviewed cohort studies and randomised trials that measured usual walking speed and subsequent falls in adults aged 65 years or older. Results: Twenty-two studies were included. Each 0.1 m/s slower walking speed was associated with a higher fall rate. Conclusions: Walking speed may help identify older adults at risk of falls.

  ## Introduction

  Falls are a leading cause of injury in older adults, and simple markers of risk are needed in primary care. Walking speed is quick to measure and predicts several adverse outcomes. Previous reviews have reported inconsistent associations with falls, partly because of differences in fall ascertainment and walking-speed protocols. We therefore synthesised prospective evidence on the association between usual walking speed and incident falls.

  ## Methods

  ### Eligibility criteria

  We included prospective cohort studies and randomised trials of adults aged 65 years or older that measured usual walking speed at baseline and recorded falls during follow-up. We excluded studies of people selected for a specific neurological disease, studies without a falls outcome, and conference abstracts without sufficient data.

  ### Information sources and search strategy

  We searched PubMed, Embase, and Web of Science from inception to March 2024. The search strategy combined terms for walking speed, gait speed, falls, and older adults. We also screened reference lists of included studies and previous reviews. Two reviewers independently screened titles, abstracts, and full texts.

  ### Data collection and items

  Two reviewers extracted study design, sample size, mean age, walking-speed protocol, fall definition, follow-up, and adjusted effect estimates. Disagreements were resolved by discussion with a third reviewer. We assessed risk of bias with the Newcastle-Ottawa Scale for cohort studies and the Cochrane risk-of-bias tool for trials.

  ### Synthesis methods

  We used random-effects meta-analysis to pool adjusted hazard ratios or rate ratios per 0.1 m/s slower walking speed. Heterogeneity was quantified with I² and tau². We assessed publication bias with funnel plots and Egger's test when at least ten studies were available. Certainty of evidence was rated with GRADE.

  ## Results

  The search identified 3,412 records. After screening, 22 studies with 18,604 participants were included: 19 cohorts and 3 trials. Mean age ranged from 68 to 84 years, and follow-up from 1 to 8 years.

  Slower walking speed was associated with a higher fall rate (pooled hazard ratio 1.18 per 0.1 m/s slower, 95% confidence interval 1.09 to 1.28). Heterogeneity was moderate (I² = 48%). The association was similar in cohorts and trials. Funnel-plot asymmetry suggested possible small-study effects, but Egger's test was not significant. GRADE certainty was low because of inconsistency and risk of bias.

  ## Discussion

  This review found a consistent association between slower walking speed and incident falls. The effect size is modest, but walking speed is inexpensive and could be used alongside other risk factors. The low certainty rating reflects differences in fall ascertainment and the observational nature of most evidence.

  Limitations include the restriction to English-language publications, the use of study-level rather than participant-level data, and the possibility of reverse causation if undiagnosed disease slowed gait before baseline. We did not include studies that measured walking speed only after a fall.

  ## Conclusion

  Slower walking speed was associated with a higher rate of falls in older adults. Walking speed may be a useful component of multifactorial fall-risk assessment, but its incremental value needs testing in primary care.

  ## Declarations

  **Ethics approval.** Ethics approval was not required for this review of published studies.

  **Consent.** Informed consent was not required because no individual participant data were accessed.

  **Funding.** This review was supported by the Northlake Ageing Research Fund (award SYN-2024-051).

  **Conflicts of interest.** The authors declare no competing interests.

  **Data availability.** Data availability: the extraction sheet and analysis code are available from the corresponding author on reasonable request.

  **Author contributions.** T.F.N. designed the review, screened records, and drafted the manuscript. H.O.S. extracted data and assessed risk of bias. Y.R.T. performed the meta-analysis and rated certainty. All authors revised and approved the final manuscript.

  **Registration.** The review protocol was registered in PROSPERO (fictional record CRD000000000000).
  `),
  },
  {
    id: 'ms-0009',
    category: 'plain-text-title',
    description:
      'Plain-text title with no markdown heading anywhere; sections and declarations use ALL-CAPS lines. The title is semantically present but has no # cue.',
    tags: ['plain-title', 'no-markdown', 'all-items-present'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  A Plain-Text Title Report on Hydration Reminders in Community Clinics

  Iris M. Vell, Tomas A. Nery

  ABSTRACT

  Background: Older adults often drink too little during hot weather. Methods: We tested a telephone hydration reminder in two community clinics. Results: The reminder group reported higher daily fluid intake than the comparison group. Conclusions: Telephone reminders are a feasible hydration strategy.

  INTRODUCTION

  Dehydration is a common and preventable cause of hospital admission in older adults. Community clinics are well placed to identify people at risk, but simple reminder programmes are rarely evaluated. We examined whether a brief telephone reminder would increase self-reported fluid intake over four weeks.

  METHODS

  We conducted a two-arm field study in two community clinics in the Northlake region. Adults aged 65 years or older who lived alone were eligible. We excluded people with a diagnosis of heart failure or a prescribed fluid restriction. Participants were assigned to the reminder group or the comparison group by clinic.

  The reminder group received a telephone call twice weekly for four weeks. A nurse asked about fluid intake, reviewed a simple hydration plan, and encouraged the participant to keep a cup nearby. The comparison group received a written hydration leaflet.

  The primary outcome was self-reported daily fluid intake at four weeks, recorded on a three-day diary. Secondary outcomes were thirst, dizziness, and satisfaction. A research assistant who was unaware of group assignment entered the diary data.

  RESULTS

  Forty-six adults joined the study: 24 in the reminder group and 22 in the comparison group. Mean age was 74.8 years, and 65% were women. Baseline fluid intake was similar between groups.

  At four weeks, the reminder group reported a mean intake of 1.7 litres per day, compared with 1.3 litres in the comparison group, a difference of 0.4 litres (95% confidence interval 0.1 to 0.7). Thirst scores were lower in the reminder group. No participant reported dizziness or required medical care.

  DISCUSSION

  Twice-weekly telephone reminders were associated with higher self-reported fluid intake in older adults living alone. The intervention was brief and used existing nursing time. The result is consistent with behavioural work showing that cues and planning can support hydration.

  The study has limitations. Fluid intake was self-reported, and participants were not blinded. The comparison group received a leaflet, which may have raised intake above usual care. The sample was small and drawn from two clinics, and follow-up ended at four weeks.

  CONCLUSION

  A brief telephone reminder programme was associated with higher fluid intake in older adults. A larger trial with objective hydration measures should test whether the effect persists and reduces dehydration-related visits.

  ETHICS APPROVAL AND CONSENT

  The Northlake Community Ethics Committee approved the study (approval SYN-ETH-2024-093). All participants gave written informed consent.

  FUNDING

  This work was supported by the Northlake Community Care Fund (award SYN-2024-058).

  CONFLICTS OF INTEREST

  The authors declare no conflicts of interest.

  DATA AVAILABILITY

  The de-identified diary data are available from the corresponding author on reasonable request.

  AUTHOR CONTRIBUTIONS

  I.M.V. designed the study and drafted the manuscript. T.A.N. delivered the reminders and entered the data. Both authors revised and approved the final manuscript.

  REGISTRATION

  The study was registered in a fictional registry (SYNTH-2024-010).
  `),
  },
  {
    id: 'ms-0010',
    category: 'mixed-language-title',
    description:
      'Mixed Chinese-English markdown title with an English body; all 14 items, including the declarations and a fictional registration, are present.',
    tags: ['mixed-language-title', 'randomized-trial', 'all-items-present'],
    missing: [],
    coreSections: CORE_SECTIONS,
    text: manuscript(`
  # 术前呼吸训练与肺部并发症：Preoperative Breathing Training and Postoperative Pulmonary Complications — A Randomized Controlled Trial

  Lena Q. Arvid, Peter S. Mowbray, Ines H. Kato

  ## Abstract

  Background: Postoperative pulmonary complications are common after major abdominal surgery. Methods: We randomized 220 adults to a preoperative breathing-training programme or usual care and measured complications in the first 30 days. Results: The training group had fewer pulmonary complications. Conclusions: Preoperative breathing training may reduce postoperative pulmonary complications.

  ## Introduction

  Major abdominal surgery carries a substantial risk of atelectasis, pneumonia, and prolonged oxygen therapy. Preoperative inspiratory muscle training has shown promise in small trials, but evidence from routine surgical pathways is limited. We tested whether a structured breathing programme delivered in the two weeks before surgery would reduce pulmonary complications.

  ## Methods

  ### Trial design and participants

  This was a two-arm, parallel-group randomized controlled trial in two teaching hospitals in the Northlake region. Eligible participants were adults aged 40 to 80 years scheduled for elective major abdominal surgery. We excluded people with severe chronic obstructive pulmonary disease, an active respiratory infection, or a planned postoperative ventilation beyond 24 hours.

  ### Intervention

  The training group received a supervised breathing programme with an inspiratory threshold device, starting 14 days before surgery and continuing until discharge. Participants performed two daily sessions and kept a diary. The control group received usual preoperative care and a leaflet on early mobilisation.

  ### Outcomes

  The primary outcome was a composite of pulmonary complications within 30 days: pneumonia, atelectasis requiring bronchoscopy, or prolonged oxygen therapy. Secondary outcomes were length of stay, intensive-care admission, and serious adverse events.

  ### Sample size, randomization, and blinding

  We planned 220 participants to detect a reduction from 20% to 9% in the primary outcome with 80% power at alpha 0.05. Randomization used a computer-generated sequence in permuted blocks of four, stratified by hospital. Allocation was concealed through a secure telephone service. Outcome assessors and analysts were blinded; participants and physiotherapists were not.

  ### Statistical methods

  The primary analysis followed the intention-to-treat principle. We compared the primary outcome using a log-binomial model and report risk ratios with 95% confidence intervals. Secondary outcomes used linear or logistic regression as appropriate. A per-protocol analysis was prespecified.

  ## Results

  Of 261 people screened, 220 were randomized: 110 to breathing training and 110 to usual care. Baseline characteristics were similar, including age, sex, and type of surgery. All participants received their allocated intervention.

  The primary outcome occurred in 18 participants (16.4%) in the training group and in 34 (30.9%) in the usual-care group, a risk ratio of 0.53 (95% confidence interval 0.32 to 0.88; p = 0.014). Length of stay was 1.6 days shorter in the training group. Intensive-care admissions and serious adverse events did not differ.

  ## Discussion

  A preoperative breathing programme reduced pulmonary complications after major abdominal surgery. The effect is plausible: inspiratory training may improve lung volumes and airway clearance in the early postoperative period. The programme was delivered before admission, which may reduce the burden on surgical wards.

  Limitations include the inability to blind participants and physiotherapists, the use of a composite outcome, and the short follow-up. The trial was conducted in two hospitals with experienced physiotherapy teams, and the results may not generalise to centres without such support.

  ## Conclusion

  Preoperative breathing training reduced pulmonary complications in adults undergoing major abdominal surgery. A multicentre trial with longer follow-up should confirm the effect and assess cost-effectiveness.

  ## Declarations

  **Ethics approval.** The Northlake University Research Ethics Committee approved the trial (approval SYN-ETH-2024-101).

  **Consent.** All participants provided written informed consent.

  **Funding.** This work was supported by the Northlake Surgical Care Fund (award SYN-2024-066).

  **Conflicts of interest.** The authors declare no conflicts of interest.

  **Data availability.** The de-identified dataset and analysis code are available from the corresponding author on reasonable request.

  **Author contributions.** L.Q.A. designed the trial and drafted the manuscript. P.S.M. supervised the breathing programme. I.H.K. performed the statistical analysis. All authors revised and approved the final manuscript.

  **Registration.** The trial was registered in a fictional registry (SYNTH-2024-011).
  `),
  },
]

// ── construction checks ─────────────────────────────────────────────────────

function check(condition, message) {
  if (!condition) throw new Error(`generate-manuscripts: ${message}`)
}

const wordCount = text => text.split(/\s+/u).filter(token => token !== '').length

for (const [index, item] of cases.entries()) {
  check(item.id === `ms-${String(index + 1).padStart(4, '0')}`, `case ${index + 1} has id ${item.id}`)
  check(CATEGORIES.includes(item.category), `${item.id}: unknown category ${item.category}`)
  check(item.text.length > 0, `${item.id}: empty text`)
  check(!item.text.includes('\r'), `${item.id}: text must use LF newlines`)
  check(item.tags.length === new Set(item.tags).size, `${item.id}: duplicate tag`)
  for (const tag of item.tags) check(TAG_SPACE.includes(tag), `${item.id}: unknown tag ${tag}`)
  for (const section of item.coreSections) check(CORE_SECTIONS.includes(section), `${item.id}: unknown core section ${section}`)
  check(item.coreSections.length === new Set(item.coreSections).size, `${item.id}: duplicate core section`)
  const expectedItems = labelItems(item.missing)
  const expectedMissing = ITEM_IDS.filter(id => expectedItems[id] === 'missing')
  check(expectedMissing.length === item.missing.length, `${item.id}: label construction lost a missing item`)
  item.expected = {
    items: expectedItems,
    missingCoreSections: CORE_SECTIONS.filter(section => !item.coreSections.includes(section)),
  }
  item.wordCount = wordCount(item.text)
  check(item.wordCount >= 300 && item.wordCount <= 800, `${item.id}: ${item.wordCount} words, expected 300-800`)

  // Construction invariant: every declared core section appears as a heading
  // line, and every declared missing core section does not. This is a check on
  // the hand-written text, not a detector and not a source of labels.
  for (const section of CORE_SECTIONS) {
    const heading = new RegExp(`^(?:#{1,6}\\s+)?${section}\\b`, 'imu')
    if (item.coreSections.includes(section)) {
      check(heading.test(item.text), `${item.id}: declared ${section} but no ${section} heading line found`)
    } else {
      check(!heading.test(item.text), `${item.id}: declared ${section} missing but a ${section} heading line was found`)
    }
  }
}

check(cases.length === TOTAL_CASES, `expected ${TOTAL_CASES} cases, built ${cases.length}`)
check(new Set(cases.map(item => item.id)).size === cases.length, 'duplicate case id')
check(new Set(cases.map(item => item.category)).size === cases.length, 'each category must appear once')
for (const category of CATEGORIES) check(cases.some(item => item.category === category), `category ${category} is not covered`)
check(cases.reduce((sum, item) => sum + Object.values(item.expected.items).filter(status => status === 'present').length, 0) >= 0, 'label sanity')
check(cases.some(item => item.category === 'plain-text-title' && !item.text.includes('#')), 'plain-text-title case must not contain #')
check(cases.some(item => item.category === 'mixed-language-title' && /[\u4e00-\u9fff]/u.test(item.text)), 'mixed-language-title case must contain Chinese characters')
check(cases.some(item => item.category === 'missing-abstract' && !/^\s*(?:#{1,6}\s+)?abstract\b/imu.test(item.text)), 'missing-abstract case must not have an abstract heading')

const totalLabels = cases.length * ITEM_IDS.length
const presentLabels = cases.reduce((sum, item) => sum + Object.values(item.expected.items).filter(status => status === 'present').length, 0)
const missingLabels = totalLabels - presentLabels
check(presentLabels + missingLabels === totalLabels, 'label totals do not add up')

const countBy = (items, pick) => {
  const counts = {}
  for (const item of items) {
    const key = pick(item)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

const byCategory = Object.fromEntries(CATEGORIES.map(category => [category, 0]))
for (const item of cases) byCategory[item.category] += 1

const byMissingItem = Object.fromEntries(ITEM_IDS.map(id => [id, 0]))
for (const item of cases) {
  for (const id of ITEM_IDS) if (item.expected.items[id] === 'missing') byMissingItem[id] += 1
}

const byTag = Object.fromEntries(TAG_SPACE.map(tag => [tag, 0]))
for (const item of cases) for (const tag of item.tags) byTag[tag] += 1

const words = cases.map(item => item.wordCount)
const wordSummary = {
  min: Math.min(...words),
  max: Math.max(...words),
  total: words.reduce((sum, value) => sum + value, 0),
  mean: Number((words.reduce((sum, value) => sum + value, 0) / words.length).toFixed(1)),
}

const missingByDocument = Object.fromEntries(
  cases.map(item => [item.id, ITEM_IDS.filter(id => item.expected.items[id] === 'missing')]),
)

const coreMissingBySection = Object.fromEntries(CORE_SECTIONS.map(section => [section, 0]))
for (const item of cases) for (const section of item.expected.missingCoreSections) coreMissingBySection[section] += 1

const summary = {
  dataset: 'manuscripts',
  version: VERSION,
  total: cases.length,
  synthetic: true,
  itemSpace: ITEM_IDS,
  statusSpace: ['present', 'missing'],
  coreSections: CORE_SECTIONS,
  labelCounts: {
    items: totalLabels,
    present: presentLabels,
    missing: missingLabels,
  },
  byCategory,
  byMissingItem,
  missingByDocument,
  coreMissing: {
    documentsWithMissingCore: cases.filter(item => item.expected.missingCoreSections.length > 0).length,
    bySection: coreMissingBySection,
  },
  wordCount: wordSummary,
  byTag,
  labelSpace: {
    item: ITEM_IDS,
    status: ['present', 'missing'],
  },
  groundTruth:
    'labels assigned by construction in this generator (no plugin import, no plugin output); missingCoreSections derived from the declared core-section set; ' +
    'every author, institution, award and registry identifier is fictional.',
  caseSchema: 'schema.json',
}

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://raw.githubusercontent.com/PerryLink/dsh-research-bench/main/data/manuscripts/schema.json',
  title: 'Synthetic manuscript-check benchmark case',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'category', 'description', 'tags', 'wordCount', 'text', 'expected'],
  properties: {
    id: { type: 'string', pattern: '^ms-[0-9]{4}$' },
    category: { enum: CATEGORIES },
    description: { type: 'string', minLength: 1, maxLength: 400 },
    tags: {
      type: 'array',
      minItems: 1,
      maxItems: TAG_SPACE.length,
      uniqueItems: true,
      items: { enum: TAG_SPACE },
    },
    wordCount: { type: 'integer', minimum: 300, maximum: 800 },
    text: { type: 'string', minLength: 1 },
    expected: {
      type: 'object',
      additionalProperties: false,
      required: ['items', 'missingCoreSections'],
      properties: {
        items: {
          type: 'object',
          additionalProperties: false,
          required: ITEM_IDS,
          properties: Object.fromEntries(ITEM_IDS.map(id => [id, { enum: ['present', 'missing'] }])),
        },
        missingCoreSections: {
          type: 'array',
          uniqueItems: true,
          items: { enum: CORE_SECTIONS },
        },
      },
    },
  },
}

const outputCases = cases.map(item => ({
  id: item.id,
  category: item.category,
  description: item.description,
  tags: item.tags,
  wordCount: item.wordCount,
  text: item.text,
  expected: item.expected,
}))

writeFileSync(path.join(outDir, 'cases.jsonl'), `${outputCases.map(item => JSON.stringify(item)).join('\n')}\n`, 'utf8')
writeFileSync(path.join(outDir, 'SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
writeFileSync(path.join(outDir, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`, 'utf8')

console.log(`manuscripts: ${cases.length} cases -> data/manuscripts/cases.jsonl`)
console.log(`words: ${JSON.stringify(wordSummary)}`)
console.log(`labels: ${presentLabels} present / ${missingLabels} missing (${totalLabels} total)`)
console.log(`by category: ${JSON.stringify(byCategory)}`)
console.log(`missing by item: ${JSON.stringify(byMissingItem)}`)
