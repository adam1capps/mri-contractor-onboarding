/* Canonical agreement terms, shared by the API functions (PDF generation,
   version checks). This text must stay in sync with training/index.html.
   Bump TERMS_VERSION whenever the terms change; every signature stores the
   version it was executed against. */

export const TERMS_VERSION = '2026-07-03.1';

export const AGREEMENT_TITLE = 'Roof MRI Certification Training Agreement';

/* sub: bold run-in heading rendered before the paragraph */
export const AGREEMENT_SECTIONS = [
  {
    num: '01',
    title: 'Acknowledgment of Roofing Industry Knowledge',
    body: [
      { text: 'Client represents that each trainee participating in the Roof MRI training has a basic working knowledge of roofing systems and job site safety procedures.' },
    ],
  },
  {
    num: '02',
    title: 'Certification, Continuing Education, and Transferability',
    body: [
      { text: 'Certification is issued to individual participants only and cannot be transferred to other persons or companies. A company may represent itself as having "Roof MRI certified staff" only if at least one of its current employees holds an active certification. If a certified employee leaves the company, the company may no longer claim to have certified staff unless others are certified.' },
      { sub: '(a) Continuing Education Requirement', text: 'Each certified individual must complete a minimum of two (2) continuing training education (CTE) credits per calendar year to maintain active certification status. CTE credit opportunities will be made available by ReDry. Failure to complete the required credits by December 31 of each calendar year will result in suspension of certification until credits are fulfilled.' },
      { sub: '(b) Company Association', text: 'Each certified individual\'s certification is associated with the company under which they were trained. The individual may only represent themselves as a Roof MRI Certified Technician while employed by or actively contracted with that company.' },
      { sub: '(c) Non-Transferability', text: 'Certification does not transfer to a new employer. If a certified individual leaves the company under which they were trained, their certification becomes inactive with respect to any new employer unless both of the following conditions are met: (i) the original certifying company provides explicit written permission authorizing the transfer, and (ii) the new employer is also a certified Roof MRI contractor in good standing.' },
    ],
  },
  {
    num: '03',
    title: 'Pre-Field Training Roof List Requirement',
    body: [
      { text: 'No later than three (3) business days prior to field training, Client must provide a list of commercial flat or low-slope roofs for use in training. No shingle, metal, or steep-slope roofs will be accepted. Client is responsible for securing roof access and ensuring the roofs are safe for training. Failure to provide the roof list on time may result in cancellation or rescheduling of training.' },
    ],
  },
  {
    num: '04',
    title: 'Unlimited MRI Package Subscription',
    body: [
      { text: 'Access to the full suite of scanning grids and MRI tools requires an active "Unlimited MRI Package" subscription. If Client opts not to maintain the subscription, Client acknowledges limited access and scanning ability. A 30-day complimentary trial is available for new trainees.' },
    ],
  },
  {
    num: '05',
    title: 'Safety Requirements and Liability Waiver',
    body: [
      { sub: '(a) Liability Waiver', text: 'All participants must sign a waiver acknowledging the risks of rooftop training, including potential injury or death. ReDry is not liable for accidents or injuries except in cases of gross negligence. Individual waivers are executed through this page before field training.' },
      { sub: '(b) Participant Fitness and Conduct', text: 'Participants confirm they are medically fit for rooftop activity. Trainers may exclude any individual who appears unfit or unsafe to participate.' },
      { sub: '(c) Required Personal Protective Equipment (PPE)', text: 'Participants must wear appropriate PPE, including non-slip footwear. Fall protection gear must be used where required by OSHA, local law, or trainer instruction. Access to the roof will be denied to anyone lacking required gear.' },
      { sub: '(d) On-Site Safety Procedures', text: 'Client must provide a safe roof access method (e.g. compliant ladder). ReDry may delay or cancel field activities due to unsafe conditions, including inclement weather.' },
      { sub: '(e) Age Requirement', text: 'Participants must be 18 years of age or older.' },
    ],
  },
  {
    num: '06',
    title: 'Intellectual Property and Confidentiality',
    body: [
      { text: 'All training materials, methods, and the Roof MRI process are proprietary and protected by an approved patent (issuance pending). No reproduction, external teaching, sublicensing, or redistribution is allowed. Materials must be handled as confidential and may not be recorded or shared without ReDry\'s written permission. Unauthorized use may result in legal action and revocation of certification.' },
    ],
  },
  {
    num: '07',
    title: 'Equipment Requirements',
    body: [
      { text: 'Each trainee must bring a qualifying moisture detection device. ReDry will provide equipment specifications beforehand. Limited loaner devices may be available but are not guaranteed. Any borrowed equipment must be returned in original condition or will be billed to Client.' },
    ],
  },
  {
    num: '08',
    title: 'Scheduling, Cancellation, and Rescheduling',
    body: [
      { text: 'Reschedules due to weather with at least 48 hours\' notice are free of charge and will be rescheduled as soon as possible. Cancellations inside of 48 hours will incur a $2,500 re-booking fee. If the trainer arrives on the scheduled date and training cannot proceed for any reason attributable to Client, a new date must be set and Client must repay the full cost of the training.' },
    ],
  },
  {
    num: '09',
    title: 'General Terms',
    body: [
      { sub: '(a) Governing Law', text: 'This Agreement will be governed by the laws of the state in which ReDry is headquartered, without regard to conflicts of law principles.' },
      { sub: '(b) Entire Agreement', text: 'This document represents the full understanding between the parties and supersedes all prior agreements regarding training.' },
      { sub: '(c) Amendments', text: 'This Agreement may be modified only in writing signed by both parties.' },
    ],
  },
  {
    num: '10',
    title: 'Acknowledgment and Execution',
    body: [
      { text: 'By signing below, the undersigned certifies that they are authorized to enter into this Agreement on behalf of the Client and to enroll the listed individuals in the Roof MRI Certification Training.' },
    ],
  },
];
