// Fighter and arena roster. Images live in client/public/assets and are the
// original art supplied for the project (prepared by tools/prepare_assets.py).
// `facing` is the direction the original drawing looks at.

export const FIGHTERS = [
  {
    id: 'deadline', name: 'DEADLINE', title: 'Офисная фурия', facing: 'left',
    color: '#c77dff', spark: 0xff9df0,
    moves: ['MEMO SLAP', 'DEADLINE RUSH', 'PENCIL STRIKE'], finisher: 'OVERTIME FURY',
    bio: 'Закрывает квартал и оппонентов. Карандаш в причёске — не для красоты.',
  },
  {
    id: 'crimson_fan', name: 'CRIMSON FAN', title: 'Танец веера', facing: 'right',
    color: '#ff4d6d', spark: 0xffcf4d,
    moves: ['FAN SLASH', 'SILK TEMPEST', 'PETAL STORM'], finisher: 'PHOENIX DANCE',
    bio: 'Два боевых веера и ни одного лишнего движения.',
  },
  {
    id: 'chain_sailor', name: 'CHAIN SAILOR', title: 'Гроза школьного двора', facing: 'right',
    color: '#8e9cff', spark: 0xd6d6ff,
    moves: ['CHAIN WHIP', 'SPIKE SWING', 'IRON LASSO'], finisher: 'MORNINGSTAR DROP',
    bio: 'Отличница. Цепь с шипованным шаром — аргумент последнего слова.',
  },
  {
    id: 'neko_shadow', name: 'NEKO SHADOW', title: 'Кошка-тень', facing: 'right',
    color: '#e040fb', spark: 0xff7bff,
    moves: ['NEKO CLAW', 'SHADOW POUNCE', 'TAIL SWEEP'], finisher: 'NINE LIVES',
    bio: 'Бесшумна, быстра и всегда приземляется на лапы.',
  },
  {
    id: 'iron_kai', name: 'IRON KAI', title: 'Мастер кунг-фу', facing: 'right',
    color: '#ffb02e', spark: 0xffe066,
    moves: ['DRAGON FIST', 'IRON KICK', 'PALM BURST'], finisher: 'HUNDRED FISTS',
    bio: 'Тренируется с рассвета. Улыбается даже на ринге.',
  },
  {
    id: 'ceo_strike', name: 'CEO STRIKE', title: 'Генеральный директор', facing: 'right',
    color: '#4d7cff', spark: 0x9db8ff,
    moves: ['TIE WHIP', 'BOARD PUNCH', 'KPI KICK'], finisher: 'HOSTILE TAKEOVER',
    bio: 'Проводит переговоры кулаками, если слова закончились.',
  },
  {
    id: 'shinobi', name: 'SHINOBI', title: 'Ниндзя ночи', facing: 'right',
    color: '#d1477a', spark: 0xff6fa3,
    moves: ['SHADOW STEP', 'KUNAI FLASH', 'SMOKE STRIKE'], finisher: 'SILENT MOON',
    bio: 'Появляется ниоткуда. Пояс цвета заката.',
  },
  {
    id: 'street_king', name: 'STREET KING', title: 'Король района', facing: 'right',
    color: '#5c7cfa', spark: 0xffffff,
    moves: ['HAYMAKER', 'BLOCK PARTY', 'CHAIN JAB'], finisher: 'KING OF THE BLOCK',
    bio: 'Выиграл каждый уличный спор. Кулаками — только для убедительности.',
  },
].map((f) => ({ ...f, img: `/assets/fighters/${f.id}.png` }));

export const ARENAS = [
  { id: 'neon_boardroom', name: 'NEON BOARDROOM', subtitle: 'Переговорная после заката', floor: 0.93, ambient: 'dust' },
  { id: 'sakura_dojo', name: 'SAKURA DOJO', subtitle: 'Додзё с видом на Фудзи', floor: 0.93, ambient: 'petals' },
  { id: 'skynet_square', name: 'SKYNET SQUARE', subtitle: 'Площадь Бишкека на закате', floor: 0.95, ambient: 'fireflies' },
].map((a) => ({ ...a, img: `/assets/arenas/${a.id}.jpg`, thumb: `/assets/arenas/${a.id}_thumb.jpg` }));

export const fighterById = (id) => FIGHTERS.find((f) => f.id === id);
export const arenaById = (id) => ARENAS.find((a) => a.id === id);

// Demo debate filled by the "Заполнить пример" link (all fields stay editable).
export const EXAMPLE = {
  topic: 'Снять ли «циклы» монтажнику Айылчы?',
  name1: 'Айжамал',
  p1: 'Я не буду убирать у тебя "циклы", так как ты отклонился за вчера по показателям от нормы и сегодня не показал хорошую динамику.',
  name2: 'Айылчы',
  p2: 'Убери у меня "циклы", пожалуйста, я завтра шоколадку занесу.',
};
