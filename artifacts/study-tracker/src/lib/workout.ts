export const DEFAULT_WORKOUT_SPLIT = [
  { day: 0, name: 'Rest — Active Recovery', rest: true, exercises: [] },
  { day: 1, name: 'Push A — Shoulder Focus', rest: false, exercises: [
    { name: 'Incline Barbell Press', sets: 4, reps: '6-10', notes: 'RPE 8 — upper chest and shoulder tie-in' },
    { name: 'Seated DB Shoulder Press', sets: 4, reps: '8-10', notes: 'RPE 8 — full range, no locking out' },
    { name: 'Cable Lateral Raises (unilateral)', sets: 4, reps: '15-20', notes: 'RPE 9 — KEY V-taper exercise, strict form' },
    { name: 'Cable Triceps Pushdowns (rope)', sets: 3, reps: '12-15', notes: 'RPE 9 — squeeze fully at bottom' },
    { name: 'Overhead Triceps Extension (cable)', sets: 3, reps: '10-12', notes: 'RPE 9 — long head stretch' },
  ]},
  { day: 2, name: 'Pull A — Width Focus', rest: false, exercises: [
    { name: 'Weighted Pull-Ups (wide grip)', sets: 4, reps: '6-10', notes: 'RPE 8 — #1 lat width builder, full stretch' },
    { name: 'Seated Cable Row (wide, FLARED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows flared ~45 deg, upper back' },
    { name: 'Single-Arm DB Row (TUCKED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows tucked to ribs, hits lats' },
    { name: 'Rear Delt Fly (pec deck reverse)', sets: 3, reps: '15-20', notes: 'RPE 9 — slow 3s eccentric, shoulder health' },
    { name: 'Incline DB Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — peak bicep stretch at bottom' },
    { name: 'Hammer Curls', sets: 3, reps: '12-15', notes: 'RPE 9 — brachialis and forearm width' },
  ]},
  { day: 3, name: 'Legs A — Quad + HIIT', rest: false, exercises: [
    { name: 'Back Squat', sets: 4, reps: '6-8', notes: 'RPE 8 — controlled descent, drive through heels' },
    { name: 'Leg Press (feet high & wide)', sets: 3, reps: '12-15', notes: 'RPE 9 — builds quad sweep' },
    { name: 'Leg Extension Machine', sets: 3, reps: '12-15', notes: 'RPE 9 — full squeeze at top' },
    { name: 'Seated Hamstring Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — slow 3s eccentric, full contraction' },
    { name: 'Standing Calf Raises', sets: 4, reps: '15-20', notes: 'RPE 9 — pause 1s at top' },
    { name: 'Hanging Leg Raises', sets: 3, reps: '15-20', notes: 'RPE 9 — no swinging, controlled' },
    { name: 'HIIT Finisher (bike/treadmill)', sets: 1, reps: '10 min', notes: '20s max sprint / 40s rest × 10 rounds' },
  ]},
  { day: 4, name: 'Push B — Chest Focus', rest: false, exercises: [
    { name: 'Barbell Bench Press (flat)', sets: 4, reps: '6-10', notes: 'RPE 8 — retract scapula, controlled descent' },
    { name: 'Incline DB Press (30 deg)', sets: 3, reps: '8-10', notes: 'RPE 8 — targets upper chest' },
    { name: 'Cable Lateral Raises (bilateral)', sets: 4, reps: '15-20', notes: 'RPE 9 — different stimulus than Day 1' },
    { name: 'Dips (weighted if possible)', sets: 3, reps: '8-12', notes: 'RPE 9 — lean forward for chest emphasis' },
    { name: 'Triceps Overhead Ext. (EZ bar)', sets: 3, reps: '10-12', notes: 'RPE 9 — full overhead stretch' },
  ]},
  { day: 5, name: 'Pull B — Thickness Focus', rest: false, exercises: [
    { name: 'Pull-Ups AMRAP (bodyweight)', sets: 4, reps: 'AMRAP', notes: 'RPE 9 — log reps each set, beat weekly' },
    { name: 'Barbell Row (TUCKED)', sets: 4, reps: '8-10', notes: 'RPE 8 — elbows tucked, heavy lat thickness' },
    { name: 'Chest-Supported DB Row (FLARED)', sets: 3, reps: '10-12', notes: 'RPE 8 — elbows flared ~45 deg, upper back' },
    { name: 'Straight-Arm Lat Pulldown', sets: 3, reps: '12-15', notes: 'RPE 9 — isolation, squeeze lats at bottom' },
    { name: 'Face Pulls (cable rope)', sets: 3, reps: '15-20', notes: 'RPE 8 — external rotation, shoulder health' },
    { name: 'Preacher Curl or EZ Bar Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — strict form, no body swing' },
    { name: 'Reverse Curls', sets: 2, reps: '12-15', notes: 'RPE 8 — forearm and brachialis' },
  ]},
  { day: 6, name: 'Legs B — Posterior Chain + HIIT', rest: false, exercises: [
    { name: 'Romanian Deadlift (RDL)', sets: 4, reps: '8-10', notes: 'RPE 8 — hinge at hips, big hamstring stretch' },
    { name: 'Hip Thrust — Barbell', sets: 4, reps: '10-12', notes: 'RPE 9 — squeeze glutes hard at top' },
    { name: 'Walking Lunges (DB)', sets: 3, reps: '10/leg', notes: 'RPE 8 — long stride, knee tracks toe' },
    { name: 'Lying Hamstring Curl', sets: 3, reps: '10-12', notes: 'RPE 9 — slow 3s down, full squeeze' },
    { name: 'Seated Calf Raises', sets: 4, reps: '15-20', notes: 'RPE 9 — different angle vs Day 3' },
    { name: 'Ab Wheel Rollouts', sets: 3, reps: '10-12', notes: 'RPE 9 — slow, core braced throughout' },
    { name: 'HIIT Finisher (bike/treadmill)', sets: 1, reps: '12 min', notes: '20s max sprint / 40s rest × 12 rounds' },
  ]},
];

// Backup plan from Lean & Strong Playbook — 4-round AMRAP circuit for days you can't make the gym.
export const HOME_CIRCUIT_EXERCISES = [
  { name: 'Push-Ups', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Bodyweight Squats', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Sit-Ups', sets: 4, reps: 'AMRAP', weight: '' },
  { name: 'Reverse Lunges (each leg)', sets: 4, reps: '15/leg', weight: '' },
  { name: 'Plank Hold', sets: 4, reps: '45-60s', weight: '' },
  { name: 'Jumping Jacks / Mountain Climbers', sets: 4, reps: '60 sec', weight: '' },
];
export const HOME_WORKOUT_SPLIT = [
  { day: 0, name: 'Rest', rest: true, exercises: [] },
  { day: 1, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 2, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 3, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 4, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 5, name: 'The Circuit', rest: false, exercises: HOME_CIRCUIT_EXERCISES },
  { day: 6, name: 'Rest', rest: true, exercises: [] },
];
