export interface Church {
  id: string;
  name: string;
  distance: string;
  nextMass: string;
  image: string;
  address: string;
  priest: string;
  massTimes: {
    weekday: string;
    weekend: string;
    special: string;
  };
  contact: {
    phone: string;
    email: string;
    web: string;
  };
  lat: number;
  lng: number;
  isFavorite: boolean;
}

export const churches: Church[] = [
  {
    id: '1',
    name: '聖家堂',
    distance: '1.2 公里',
    nextMass: '今天 18:00',
    image: 'https://picsum.photos/seed/sagrada/400/300',
    address: '台北市 大安區',
    priest: 'Mauro Gambetti 神父',
    massTimes: {
      weekday: '09:00, 10:00, 11:00, 12:00, 17:00 (義大利語)',
      weekend: '09:00, 10:30, 11:15 (拉丁語), 12:15, 16:00, 17:45 (義大利語)',
      special: '聖誕節與復活節時間將另行公佈，請查詢官方網站。'
    },
    contact: { phone: '+39 06 6982', email: 'spv@vatican.va', web: 'www.vatican.va' },
    lat: 25.0330, lng: 121.5654,
    isFavorite: true
  },
  {
    id: '2',
    name: '聖母無原罪主教座堂',
    distance: '2.5 公里',
    nextMass: '今天 19:30',
    image: 'https://picsum.photos/seed/cathedral/400/300',
    address: '台北市 中正區',
    priest: 'John Doe 神父',
    massTimes: { weekday: '08:00', weekend: '09:00, 11:00', special: '無' },
    contact: { phone: '02-1234-5678', email: 'info@cathedral.tw', web: 'www.cathedral.tw' },
    lat: 25.0400, lng: 121.5150,
    isFavorite: true
  },
  {
    id: '3',
    name: '聖若瑟堂',
    distance: '3.1 公里',
    nextMass: '明天 07:00',
    image: 'https://picsum.photos/seed/joseph/400/300',
    address: '新北市 板橋區',
    priest: 'Jane Smith 修女',
    massTimes: { weekday: '07:00', weekend: '08:00, 10:00', special: '無' },
    contact: { phone: '02-8765-4321', email: 'contact@stjoseph.tw', web: 'www.stjoseph.tw' },
    lat: 25.0100, lng: 121.4600,
    isFavorite: false
  },
  {
    id: '4',
    name: '玫瑰聖母聖殿主教座堂',
    distance: '4.5 公里',
    nextMass: '明天 08:30',
    image: 'https://picsum.photos/seed/rosary/400/300',
    address: '高雄市 苓雅區',
    priest: 'Peter Lee 神父',
    massTimes: { weekday: '08:30', weekend: '09:30, 11:30', special: '無' },
    contact: { phone: '07-123-4567', email: 'hello@rosary.tw', web: 'www.rosary.tw' },
    lat: 22.6200, lng: 120.3100,
    isFavorite: true
  },
  {
    id: '5',
    name: '聖伯多祿大殿',
    distance: '9000 公里',
    nextMass: '今天 17:00',
    image: 'https://picsum.photos/seed/peter/400/300',
    address: 'Piazza San Pietro, 00120 Città del Vaticano, Vatican City',
    priest: 'Mauro Gambetti 神父',
    massTimes: {
      weekday: '09:00, 10:00, 11:00, 12:00, 17:00 (義大利語)',
      weekend: '09:00, 10:30, 11:15 (拉丁語), 12:15, 16:00, 17:45 (義大利語)',
      special: '聖誕節與復活節時間將另行公佈，請查詢官方網站。'
    },
    contact: { phone: '+39 06 6982', email: 'spv@vatican.va', web: 'www.vatican.va' },
    lat: 41.9022, lng: 12.4539,
    isFavorite: false
  }
];

export const savedRoutes = [
  {
    id: 'r1',
    name: '台灣北部教堂巡禮',
    destinations: '目的地：聖家堂、玫瑰聖母聖殿主教座堂、法蒂瑪聖母堂...',
    distance: '約 125 公里',
    time: '2 天'
  },
  {
    id: 'r2',
    name: '聖母聖殿之旅',
    destinations: '目的地：萬金聖母聖殿、羅厝天主堂...',
    distance: '約 350 公里',
    time: '3 天'
  },
  {
    id: 'r3',
    name: '復活節教堂巡禮',
    destinations: '目的地：復活堂、耶穌聖心堂...',
    distance: '約 50 公里',
    time: '1 天'
  }
];
