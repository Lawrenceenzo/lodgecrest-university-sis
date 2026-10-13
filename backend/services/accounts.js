// Money maths on whole centavos, so 0.1 + 0.2 never turns into 0.30000000000000004.
const toCentavos = (pesos) => Math.round(pesos * 100);
const toPesos = (centavos) => centavos / 100;
const sumPesos = (items) => toPesos(items.reduce((total, i) => total + toCentavos(i.amount), 0));

// Balance = what was charged - what was paid. Positive = the student owes; negative = overpaid.
function computeBalance(charges, payments) {
  const totalCharges = sumPesos(charges);
  const totalPayments = sumPesos(payments);
  return { totalCharges, totalPayments, balance: toPesos(toCentavos(totalCharges) - toCentavos(totalPayments)) };
}

module.exports = { toCentavos, toPesos, sumPesos, computeBalance };
