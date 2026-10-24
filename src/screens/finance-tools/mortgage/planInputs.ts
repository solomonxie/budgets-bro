import { useCalcField } from '../useCalcField';
import { useCalcChoice } from '../calcForm';
import type {
  Compounding,
  PaymentFrequency,
} from '../../../finance-tools/canadianMortgage';

export type DownUnit = 'percent' | 'amount';

// The saved fields the plan itself is computed from; a section's own
// what-if fields (rent, a new rate) stay in that section.
export function usePlanInputs() {
  const [downUnit, setDownUnit] = useCalcChoice<DownUnit>(
    'downUnit',
    'percent',
  );
  const [frequency, setFrequency] = useCalcChoice<PaymentFrequency>(
    'frequency',
    'monthly',
  );
  const [compounding, setCompounding] = useCalcChoice<Compounding>(
    'compounding',
    'semiAnnual',
  );
  const [province, setProvince] = useCalcChoice<string>('province', 'BC');
  const [firstTime, setFirstTime] = useCalcChoice<'0' | '1'>(
    'firstTimeBuyer',
    '0',
  );
  const [toronto, setToronto] = useCalcChoice<'0' | '1'>('toronto', '0');
  return {
    price: useCalcField('', 'price'),
    down: useCalcField('', 'down'),
    downUnit,
    setDownUnit,
    rate: useCalcField('', 'rate'),
    years: useCalcField('25', 'years'),
    termYears: useCalcField('5', 'termYears'),
    frequency,
    setFrequency,
    compounding,
    setCompounding,
    province,
    setProvince,
    firstTime,
    setFirstTime,
    toronto,
    setToronto,
    propertyTaxRate: useCalcField('', 'propertyTaxRate'),
    condoFees: useCalcField('', 'condoFees'),
    heat: useCalcField('', 'heat'),
    otherExpenses: useCalcField('', 'otherExpenses'),
    rentalIncome: useCalcField('', 'rentalIncome'),
    otherClosing: useCalcField('', 'otherClosing'),
    income: useCalcField('', 'income'),
    otherDebts: useCalcField('', 'otherDebts'),
  };
}

export type PlanInputs = ReturnType<typeof usePlanInputs>;
