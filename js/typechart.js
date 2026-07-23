// Standard Gen 6+ type chart (18 types), as used by Pokemon Champions.
// TYPE_CHART[attacker][defender] = multiplier. Missing entry = 1.
const TYPES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'
];

const TYPE_CHART = {
  Normal:   { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire:     { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water:    { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass:    { Fire: 0.5, Water: 2, Grass: 0.5, Poison: 0.5, Ground: 2, Flying: 0.5, Bug: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice:      { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Fighting: { Normal: 2, Ice: 2, Poison: 0.5, Flying: 0.5, Psychic: 0.5, Bug: 0.5, Rock: 2, Ghost: 0, Dark: 2, Steel: 2, Fairy: 0.5 },
  Poison:   { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5, Steel: 0, Fairy: 2 },
  Ground:   { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2, Steel: 2 },
  Flying:   { Electric: 0.5, Grass: 2, Fighting: 2, Bug: 2, Rock: 0.5, Steel: 0.5 },
  Psychic:  { Fighting: 2, Poison: 2, Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Bug:      { Fire: 0.5, Grass: 2, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Psychic: 2, Ghost: 0.5, Dark: 2, Steel: 0.5, Fairy: 0.5 },
  Rock:     { Fire: 2, Ice: 2, Fighting: 0.5, Ground: 0.5, Flying: 2, Bug: 2, Steel: 0.5 },
  Ghost:    { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon:   { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark:     { Fighting: 0.5, Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel:    { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy:    { Fire: 0.5, Fighting: 2, Poison: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 }
};

// Standard Pokemon type colors — used only for type badges, always paired with the type name.
const TYPE_COLORS = {
  Normal: '#9fa19f', Fire: '#e62829', Water: '#2980ef', Electric: '#fac000',
  Grass: '#3fa129', Ice: '#3dcef3', Fighting: '#ff8000', Poison: '#9141cb',
  Ground: '#915121', Flying: '#81b9ef', Psychic: '#ef4179', Bug: '#91a119',
  Rock: '#afa981', Ghost: '#704170', Dragon: '#5060e1', Dark: '#624d4e',
  Steel: '#60a1b8', Fairy: '#ef70ef'
};

// Abilities present in the Champions roster that modify incoming type effectiveness.
// value: multiplier applied on top of the type calculation (0 = immunity).
const ABILITY_MODIFIERS = {
  'Levitate':      { Ground: 0 },
  'Earth Eater':   { Ground: 0 },
  'Water Absorb':  { Water: 0 },
  'Dry Skin':      { Water: 0, Fire: 1.25 },
  'Volt Absorb':   { Electric: 0 },
  'Lightning Rod': { Electric: 0 },
  'Motor Drive':   { Electric: 0 },
  'Flash Fire':    { Fire: 0 },
  'Sap Sipper':    { Grass: 0 },
  'Purifying Salt':{ Ghost: 0.5 },
  'Thick Fat':     { Fire: 0.5, Ice: 0.5 },
  'Heatproof':     { Fire: 0.5 },
  'Water Bubble':  { Fire: 0.5 },
  'Fluffy':        { Fire: 2 }
};

// Effectiveness of attackType into a defender with `types` (1 or 2) and optional ability.
function effectiveness(attackType, types, ability) {
  let mult = 1;
  for (const t of types) {
    const row = TYPE_CHART[attackType];
    if (row && row[t] !== undefined) mult *= row[t];
  }
  const mod = ability && ABILITY_MODIFIERS[ability];
  if (mod && mod[attackType] !== undefined) {
    mult = mod[attackType] === 0 ? 0 : mult * mod[attackType];
  }
  return mult;
}
