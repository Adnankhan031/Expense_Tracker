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
  /**
   * Words that say what the product *is*, not what it tastes of.
   *
   * Japanese product names put the form last and the flavour first, so
   * バナナカステラ is a castella and 果汁グミぶどう is a gummy. Matching on
   * length alone let the flavour win — banana cake was filed as fruit and
   * grape gummies as fresh produce. A strong word outranks any flavour word,
   * however long that flavour word happens to be.
   */
  strong?: string[];
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
    
      '鯖', 'さば', 'さけふれーく', '鮭フレーク', 'つな', 'しらす', 'ちりめん',
      'かつお', 'かつおぶし', 'ほっけ', 'ぶり', 'たい', 'ししゃも', 'めんたいこ',
      '明太子', 'たらこ', 'かまぼこ', 'はんぺん', 'つみれ',],
    strong: ['にく', '肉', 'さかな', '魚', 'とり', '鶏', 'ぶた', '豚', 'ぎゅう', '牛',
      // A fish name identifies the product even inside a longer one.
      '鯖', 'さば', '鮭', 'さけ', 'まぐろ', 'かつお', 'ぶり', 'あじ', 'いわし', 'えび'],
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
    
      'qbb', 'qb', 'ろっぴー', '6p', 'ぷろせすちーず', 'べびーちーず', 'かまんべーる',
      'すらいすちーず', 'とろけるちーず', 'のむよーぐると', 'かるぴす',],
    strong: ['ちーず', 'ぎゅうにゅう', '牛乳', 'よーぐると', 'たまご', '卵', 'ばたー'],
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
      // Instant noodles, by product and by the brands that dominate the shelf.
      '日清', 'にっしん', 'かっぷ', 'かっぷめん', 'いんすたんと', 'やきそば',
      'まるちゃん', 'さっぽろいちばん', 'ちきんらーめん', 'どんべえ', 'あっさり',
      'cup noodle', 'cupnoodle', 'instant noodle', 'ramen', 'maggi',
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
    
      // Curry roux is sold by brand and heat, never as "curry powder".
      'ごーるでんかれー', 'ばーもんとかれー', 'こくまろ', 'ジャワかれー',
      'あまくち', '甘口', 'ちゅうから', '中辛', 'からくち', '辛口', 'るー',
      'めんつゆ', 'ぽんず', 'てんつゆ', 'やきにくのたれ', 'たれ', 'ふりかけ',
      'まぜこみ', '混ぜ込み',],
    strong: ['かれー', 'るー', 'しょうゆ', '醤油', 'みそ', '味噌', 'そーす', 'どれっしんぐ',
      'まよねーず', 'けちゃっぷ', 'つゆ', 'めんつゆ', 'ぽんず', 'あぶら', 'すぱいす',
      // On a grocery receipt these mark curry roux almost without exception.
      '甘口', 'あまくち', '中辛', 'ちゅうから', '辛口', 'からくち'],
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
    
      // Product forms and the brands that fill a Japanese snack aisle.
      'ぐみ', '果汁ぐみ', 'かすてら', '雪の宿', 'ゆきのやど', '羊羹', 'ようかん',
      'いもようかん', '芋羊羹', 'どーなつ', 'ついすとどーなつ', 'ちょこぱい', 'ぱい',
      'まんじゅう', '饅頭', 'だいふく', '大福', 'どらやき', 'ばうむくーへん',
      'おかき', 'あられ', 'かりんとう', 'ぽっきー', 'きのこのやま', 'たけのこのさと',
      'かんとりーまあむ', 'じゃがりこ', 'かっぱえびせん', 'ぷりっつ', 'おーざっく',
      'くらっかー', 'たると', 'ますこっと', 'まるだいずせん', '丸大豆せん',],
    strong: ['ぐみ', 'かすてら', 'せんべい', '煎餅', 'ようかん', '羊羹', 'けーき', 'ぱい',
      'どーなつ', 'びすけっと', 'くっきー', 'ちょこ', 'まんじゅう', '饅頭', 'だいふく',
      '大福', 'どらやき', 'ばうむくーへん', 'おかき', 'あられ', 'すなっく', 'ちっぷす',
      'ぷりん', 'ぜりー', 'あいす', 'がむ', 'らむね', 'きゃんでぃ', 'ぽっきー', 'たると',
      // Brands that ARE the product, not a flavour of one.
      '雪の宿', 'ゆきのやど', 'かんとりーまあむ', 'きのこのやま', 'たけのこのさと'],
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
    
      // Brands, because a Japanese shelf is brand names not descriptions.
      'ぺぷし', 'こかこーら', 'ふぁんた', 'すぷらいと', 'みつや', 'さんとりー',
      'いえもん', 'あやたか', 'ごごのこうちゃ', 'ぽかり', 'あくえりあす', 'おろなみん',
      'れっどぶる', 'もんすたー', 'りぽびたん', 'なちゅらるみねらる', 'いろはす',
      'あさひ', 'きりん', 'さっぽろ', 'えびす', 'ほろよい', 'すとろんぐぜろ',
      'zero', 'ml', '牛乳以外',],
    strong: ['こーら', 'ぺぷし', 'さいだー', 'じゅーす', 'こーひー', 'おちゃ', 'びーる',
      'わいん', 'さけ', 'みず', 'たんさん', 'どりんく', 'ちゅーはい', 'はいぼーる'],
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
