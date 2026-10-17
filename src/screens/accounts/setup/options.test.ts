import { defaultAnswers } from '../../../domain/accountSetup';
import { anyPicked, isPicked, pick, stepOptions } from './options';

describe('setup options', () => {
  it('replaces a single choice and toggles a multi choice', () => {
    let a = pick(defaultAnswers('us'), 'housing:mortgage');
    expect(a.housing).toBe('mortgage');
    a = pick(a, 'cards:3');
    expect(isPicked(a, 'cards:3')).toBe(true);
    a = pick(a, 'loans:car');
    expect(isPicked(a, 'loans:car')).toBe(true);
    a = pick(a, 'loans:car');
    expect(isPicked(a, 'loans:car')).toBe(false);
  });

  it('counts only options shown for the chosen country', () => {
    const a = { ...defaultAnswers('us'), invest: ['ca_tfsa' as const] };
    expect(anyPicked('saving', { ...a, savings: [] })).toBe(false);
    expect(anyPicked('saving', { ...a, country: 'ca' as const, savings: [] })).toBe(true);
  });

  it('gives every option a glyph and a label', () => {
    for (const step of ['country', 'home', 'daily', 'cards', 'saving', 'loans', 'else'] as const) {
      for (const o of stepOptions(step, 'cn')) {
        expect(o.glyph).toBeTruthy();
        expect(o.label).toBeTruthy();
      }
    }
  });
});
