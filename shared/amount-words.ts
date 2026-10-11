// Spells out monetary amounts for printed receipts ("Arrêté le présent reçu
// à la somme de …"), in French and English. Integer FCFA amounts only —
// decimals are rounded, as the currency has no cents in practice.

const FR_UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
];

function frBelowHundred(n: number): string {
  if (n < 17) return FR_UNITS[n];
  if (n < 20) return `dix-${FR_UNITS[n - 10]}`;
  const tensNames: Record<number, string> = {
    20: 'vingt',
    30: 'trente',
    40: 'quarante',
    50: 'cinquante',
    60: 'soixante',
  };
  if (n < 70) {
    const tens = Math.floor(n / 10) * 10;
    const rest = n - tens;
    if (rest === 0) return tensNames[tens];
    if (rest === 1) return `${tensNames[tens]} et un`;
    return `${tensNames[tens]}-${frBelowHundred(rest)}`;
  }
  if (n < 80) {
    // 70–79 : soixante-dix … soixante-dix-neuf, avec « soixante et onze ».
    if (n === 71) return 'soixante et onze';
    return `soixante-${frBelowHundred(n - 60)}`;
  }
  // 80–99 : quatre-vingt(s), sans « et ».
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${frBelowHundred(n - 80)}`;
}

/**
 * `beforeMille` : « cent » et « quatre-vingts » perdent leur « s » devant un
 * autre adjectif numéral (« trois cent mille », « quatre-vingt mille »), mais
 * le gardent devant les noms « million(s) » / « milliard(s) ».
 */
function frBelowThousand(n: number, beforeMille = false): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) {
    const words = frBelowHundred(n);
    return beforeMille && n === 80 ? 'quatre-vingt' : words;
  }
  const hundredWord =
    hundreds === 1
      ? 'cent'
      : rest === 0 && !beforeMille
        ? `${FR_UNITS[hundreds]} cents`
        : `${FR_UNITS[hundreds]} cent`;
  if (rest === 0) return hundredWord;
  return `${hundredWord} ${frBelowThousand(rest, beforeMille)}`;
}

/** 1234 → « mille deux cent trente-quatre ». */
export function numberToFrenchWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'zéro';

  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (billions > 0) {
    parts.push(
      billions === 1
        ? 'un milliard'
        : `${frBelowThousand(billions)} milliards`,
    );
  }
  if (millions > 0) {
    parts.push(
      millions === 1 ? 'un million' : `${frBelowThousand(millions)} millions`,
    );
  }
  if (thousands > 0) {
    // « mille » est invariable et ne prend pas « un » devant.
    parts.push(
      thousands === 1 ? 'mille' : `${frBelowThousand(thousands, true)} mille`,
    );
  }
  if (rest > 0) parts.push(frBelowThousand(rest));

  return parts.join(' ');
}

const EN_UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const EN_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

function enBelowThousand(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  let rest = n % 100;
  if (hundreds > 0) parts.push(`${EN_UNITS[hundreds]} hundred`);
  if (rest >= 20) {
    const unit = rest % 10;
    parts.push(unit ? `${EN_TENS[Math.floor(rest / 10)]}-${EN_UNITS[unit]}` : EN_TENS[Math.floor(rest / 10)]);
    rest = 0;
  }
  if (rest > 0) parts.push(EN_UNITS[rest]);
  return parts.join(' ');
}

/** 1234 → "one thousand two hundred thirty-four". */
export function numberToEnglishWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return 'zero';

  const parts: string[] = [];
  const scales: Array<[number, string]> = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1000, 'thousand'],
  ];
  let remaining = n;
  for (const [scale, name] of scales) {
    const count = Math.floor(remaining / scale);
    if (count > 0) {
      parts.push(`${enBelowThousand(count)} ${name}`);
      remaining %= scale;
    }
  }
  if (remaining > 0) parts.push(enBelowThousand(remaining));
  return parts.join(' ');
}

/** « quarante mille francs CFA » — insère « de » après million(s)/milliard(s). */
export function amountInWordsFr(value: number): string {
  const words = numberToFrenchWords(value);
  const needsDe = /(million|millions|milliard|milliards)$/.test(words);
  return `${words}${needsDe ? ' de' : ''} francs CFA`;
}

/** "forty thousand CFA francs". */
export function amountInWordsEn(value: number): string {
  return `${numberToEnglishWords(value)} CFA francs`;
}
