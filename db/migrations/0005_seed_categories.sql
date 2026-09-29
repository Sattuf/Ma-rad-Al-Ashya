-- 0005 — Reference data: the category tree.
--
-- Listings need a category (the mobile form requires one) and no endpoint creates
-- categories, so an empty database could not publish anything. Idempotent: a slug that
-- already exists is left as it is, so hand-made categories survive.

INSERT INTO categories (name, slug) VALUES
  ('سيارات ومركبات',        'vehicles'),
  ('عقارات',                'real-estate'),
  ('إلكترونيات',            'electronics'),
  ('أثاث ومنزل',            'home-furniture'),
  ('أزياء وإكسسوارات',      'fashion'),
  ('رياضة وهوايات',         'sports-hobbies'),
  ('أطفال وألعاب',          'kids-toys'),
  ('حيوانات أليفة',         'pets'),
  ('معدات وأدوات',          'tools-equipment'),
  ('خدمات',                 'services'),
  ('أخرى',                  'other')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO categories (name, slug, parent_id)
SELECT child.name, child.slug, parent.id
FROM (VALUES
  ('سيارات للبيع',          'cars',              'vehicles'),
  ('دراجات نارية',          'motorcycles',       'vehicles'),
  ('قطع غيار',              'car-parts',         'vehicles'),
  ('شقق',                   'apartments',        'real-estate'),
  ('منازل وفلل',            'houses',            'real-estate'),
  ('أراضٍ',                 'land',              'real-estate'),
  ('محلات ومكاتب',          'commercial',        'real-estate'),
  ('جوالات وأجهزة لوحية',   'phones-tablets',    'electronics'),
  ('حواسيب',                'computers',         'electronics'),
  ('تلفزيونات وصوتيات',     'tv-audio',          'electronics'),
  ('ألعاب فيديو',           'video-games',       'electronics'),
  ('كاميرات',               'cameras',           'electronics'),
  ('غرف نوم',               'bedrooms',          'home-furniture'),
  ('غرف جلوس',              'living-rooms',      'home-furniture'),
  ('أدوات مطبخ',            'kitchen',           'home-furniture'),
  ('أجهزة منزلية',          'appliances',        'home-furniture'),
  ('ملابس رجالية',          'men-clothing',      'fashion'),
  ('ملابس نسائية',          'women-clothing',    'fashion'),
  ('ساعات ومجوهرات',        'watches-jewelry',   'fashion')
) AS child(name, slug, parent_slug)
JOIN categories parent ON parent.slug = child.parent_slug
ON CONFLICT (slug) DO NOTHING;
