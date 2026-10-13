// Sample-data building blocks shared by the seed and the starter-record generator.

// Small seeded random generator, so the sample data is the same on every machine.
function makeRng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROFESSORS = [
  'Prof. Ramon Dela Cruz', 'Prof. Liza Navarro', 'Prof. Eduardo Mercado', 'Prof. Maricel Bautista',
  'Prof. Antonio Villareal', 'Prof. Cynthia Ocampo', 'Prof. Ernesto Salazar', 'Prof. Rosario Tan',
];

// Class time slots, alternating Mon/Wed/Fri hours and Tue/Thu hour-and-a-half blocks. Offerings in
// the same section take the next free slot, so a section's schedule never overlaps itself.
const MWF = [['08:00', '09:00'], ['09:00', '10:00'], ['10:00', '11:00'], ['11:00', '12:00'], ['13:00', '14:00'], ['14:00', '15:00']];
const TTH = [['08:00', '09:30'], ['09:30', '11:00'], ['11:00', '12:30'], ['13:00', '14:30'], ['14:30', '16:00'], ['16:00', '17:30']];
const TIME_SLOTS = MWF.flatMap((m, i) => [{ days: ['Mon', 'Wed', 'Fri'], time: m }, { days: ['Tue', 'Thu'], time: TTH[i] }]);

module.exports = { makeRng, PROFESSORS, TIME_SLOTS };
