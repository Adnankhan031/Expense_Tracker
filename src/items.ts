/**
 * Line-item subcategories, and the dictionary that recognises them.
 *
 * A receipt total lands in one category — Groceries — but the shopping inside
 * it is not one thing: ¥14,000 at Gyomu is rice and oil and chicken and crisps,
 * and knowing the split is the whole point of scanning the bill.
 *
 * Subcategories hang off a parent category by key, so the mechanism generalises
 * later (Food & Drink could gain its own) without another migration.
 *
 * The dictionary carries Japanese, English and Indian-grocery terms together
 * because that is what is actually in the basket here. Everything is matched
 * through `foldJa`, so half-width receipt katakana, ordinary katakana, hiragana
 * and romaji all reach the same entry.
 */

export type SubCategory = {
  key: string;
  parent: string;
  name: string;
  icon: string;
  color: string;
  keywords: string[];
};

export const SUB_CATEGORIES: SubCategory[] = [
  {
    key: 'produce',
    parent: 'groceries',
    name: 'Fresh Produce',
    icon: 'carrot',
    color: '#4ADE80',
    keywords: [
      // 野菜・果物
      'やさい', '野菜', 'きゃべつ', 'にんじん', '人参', 'たまねぎ', '玉ねぎ', '玉葱',
      'じゃがいも', 'とまと', 'きゅうり', 'れたす', 'ほうれん草', 'ほうれんそう', 'ねぎ',
      'もやし', 'なす', 'ぴーまん', 'ぶろっこりー', 'だいこん', '大根', 'ごぼう', 'かぼちゃ',
      'さつまいも', 'しめじ', 'えのき', 'しいたけ', 'きのこ', 'にんにく', 'しょうが', '生姜',
      'ばなな', 'りんご', 'みかん', 'いちご', 'ぶどう', 'なし', 'きうい', 'れもん', 'あぼかど',
      '果物', 'ふるーつ', 'さらだ',
      // English / Indian
      'vegetable', 'veg', 'onion', 'tomato', 'potato', 'carrot', 'cabbage', 'spinach',
      'coriander', 'cilantro', 'curry leaves', 'green chilli', 'chilli', 'ginger', 'garlic',
      'okra', 'bhindi', 'brinjal', 'eggplant', 'banana', 'apple', 'orange', 'mango', 'lemon',
      'lime', 'fruit', 'salad', 'cucumber', 'beans', 'peas',
    ],
  },
  {
    key: 'meat',
    parent: 'groceries',
    name: 'Meat & Fish',
    icon: 'beef',
    color: '#F87171',
    keywords: [
      'にく', '肉', 'とり', '鶏', '鳥', 'とりにく', '鶏肉', 'とりもも', 'とりむね', 'ささみ',
      'てば', '手羽', 'ぶた', '豚', '豚肉', 'ぶたにく', 'ぎゅう', '牛', '牛肉', 'ぎゅうにく',
      'ひきにく', 'ひき肉', '挽肉', 'べーこん', 'はむ', 'そーせーじ', 'ういんなー',
      'さかな', '魚', 'さけ', '鮭', 'さーもん', 'まぐろ', 'さば', '鯖', 'あじ', 'いわし',
      'えび', '海老', 'いか', 'たこ', 'ほたて', 'かに', 'しらす', 'ちくわ',
      'chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'fish', 'prawn', 'shrimp',
      'keema', 'mince', 'meat', 'bacon', 'ham', 'sausage', 'salmon', 'tuna',
    ],
  },
  {
    key: 'dairy',
    parent: 'groceries',
    name: 'Dairy & Eggs',
    icon: 'milk',
    color: '#60A5FA',
    keywords: [
      'ぎゅうにゅう', '牛乳', 'みるく', 'よーぐると', 'ちーず', 'ばたー', 'たまご', '卵', '玉子',
      '生クリーム', 'くりーむ', '豆乳', 'まーがりん',
      'milk', 'curd', 'yoghurt', 'yogurt', 'paneer', 'cheese', 'butter', 'ghee', 'cream',
      'egg', 'eggs', 'dahi', 'buttermilk',
    ],
  },
  {
    key: 'staples',
    parent: 'groceries',
    name: 'Staples & Grains',
    icon: 'wheat',
    color: '#FBBF24',
    keywords: [
      'こめ', '米', 'ごはん', 'ご飯', 'ぱん', '食パン',
      // Rice is sold by cultivar here, so the variety name is the product name.
      'こしひかり', 'あきたこまち', 'ひとめぼれ', 'ななつぼし', 'ゆめぴりか', 'はえぬき',
      'ささにしき', 'つや姫', 'むすび', '無洗米', 'げんまい', '玄米', 'はくまい', '白米', 'うどん', 'そば', 'そうめん', 'ぱすた',
      'すぱげってぃ', 'らーめん', '小麦粉', 'こむぎこ', '米粉', '片栗粉', 'おーとみーる',
      'しりある', 'もち', '餅', 'めん', '麺',
      'rice', 'basmati', 'atta', 'flour', 'maida', 'wheat', 'dal', 'daal', 'lentil', 'toor',
      'moong', 'chana', 'rajma', 'chickpea', 'idli', 'idly', 'dosa', 'batter', 'rava',
      'sooji', 'semolina', 'poha', 'upma', 'vermicelli', 'noodles', 'bread', 'pasta', 'oats',
    ],
  },
  {
    key: 'spices',
    parent: 'groceries',
    name: 'Spices & Condiments',
    icon: 'soup',
    color: '#FB923C',
    keywords: [
      'しょうゆ', '醤油', 'みそ', '味噌', 'しお', '塩', 'さとう', '砂糖', 'あぶら', '油',
      'さらだ油', 'おりーぶおいる', 'そーす', 'まよねーず', 'けちゃっぷ', '酢', 'みりん',
      'だし', 'かれー', 'こしょう', '胡椒', 'すぱいす', 'どれっしんぐ', 'ふりかけ',
      'masala', 'turmeric', 'haldi', 'jeera', 'cumin', 'garam masala', 'sambar', 'sambhar',
      'rasam', 'chilli powder', 'mustard', 'hing', 'asafoetida', 'tamarind', 'imli',
      'oil', 'salt', 'sugar', 'vinegar', 'sauce', 'ketchup', 'mayonnaise', 'curry powder',
      'spice', 'pickle', 'achar',
    ],
  },
  {
    key: 'snacks',
    parent: 'groceries',
    name: 'Snacks & Sweets',
    icon: 'cookie',
    color: '#F472B6',
    keywords: [
      'おかし', 'お菓子', 'かし', 'すなっく', 'ぽてち', 'ぽてとちっぷす', 'ちっぷす',
      'ちょこ', 'ちょこれーと', 'くっきー', 'びすけっと', 'せんべい', '煎餅', 'あめ',
      'きゃんでぃ', 'ぐみ', 'あいす', 'あいすくりーむ', 'けーき', 'どーなつ', 'ぷりん', 'ぜりー',
      'snack', 'chips', 'biscuit', 'cookie', 'chocolate', 'candy', 'namkeen', 'mixture',
      'sev', 'bhujia', 'murukku', 'wafer', 'ice cream', 'cake', 'sweets', 'laddu', 'barfi',
    ],
  },
  {
    key: 'drinks',
    parent: 'groceries',
    name: 'Beverages',
    icon: 'soda',
    color: '#22D3EE',
    keywords: [
      'のみもの', '飲料', 'おちゃ', 'お茶', '茶', '緑茶', '麦茶', 'こーひー', 'じゅーす',
      'みず', '水', 'みねらるうぉーたー', 'こーら', 'さいだー', 'びーる', '酒', 'わいん',
      'ちゅーはい', 'すぽーつどりんく', '炭酸', 'にゅうさんきん',
      'tea', 'chai', 'coffee', 'juice', 'water', 'soda', 'cola', 'beer', 'wine', 'drink',
      'lassi', 'squash',
    ],
  },
  {
    key: 'frozen',
    parent: 'groceries',
    name: 'Frozen & Ready',
    icon: 'snow',
    color: '#A78BFA',
    keywords: [
      '冷凍', 'れいとう', '冷凍食品', '惣菜', 'そうざい', 'べんとう', '弁当', 'おにぎり',
      '冷食', 'ぴざ', '餃子', 'ぎょうざ', 'からあげ', '唐揚げ', 'ころっけ', 'てんぷら', '天ぷら',
      'frozen', 'ready meal', 'bento', 'pizza', 'dumpling', 'paratha', 'roti', 'chapati',
      'samosa', 'nugget',
    ],
  },
];

export const SUB_BY_KEY = new Map(SUB_CATEGORIES.map((s) => [s.key, s]));

/** Subcategories belonging to a parent category key. */
export function subCategoriesFor(parentKey: string): SubCategory[] {
  return SUB_CATEGORIES.filter((s) => s.parent === parentKey);
}
