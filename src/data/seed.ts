import { publicUrl, type Recipe } from '../types'

export function seedRecipes(): Recipe[] {
  return [
    {
      id: 'hongshaorou',
      name: '红烧肉',
      photos: [
        publicUrl('food/hongshaorou.jpg'),
        publicUrl('food/hongshaorou2.jpg'),
        publicUrl('food/hongshaorou3.jpg'),
      ],
      duration: '约 2 小时',
      cookedAt: '2026-11-05',
      timesCooked: 5,
      method:
        '五花肉切块，冷水焯水，撇沫沥干。\n小火炒糖色，琥珀小泡时下肉上色。\n加调味和热水，小火焖 60–80 分钟。\n大火收汁，撒白芝麻起锅。',
      pits: [
        '糖色千万别等焦了才下肉——偏琥珀、刚冒小泡就要下肉；等深褐再下容易发苦。火一定要小。',
        '火一定要小，肉块别切太大，不然外烂内硬。',
      ],
      tags: [
        { label: '成功', kind: 'ok' },
        { label: '糖色易焦', kind: 'pit' },
        { label: '家常', kind: 'plain' },
      ],
      isDraft: false,
      isSignature: true,
      toRetry: true,
      shared: true,
      loved: false,
      createdAt: '2026-09-12T10:00:00.000Z',
      updatedAt: '2026-11-05T18:20:00.000Z',
    },
    {
      id: 'broccoli',
      name: '蒜蓉西兰花',
      photos: [publicUrl('food/broccoli.jpg')],
      duration: '约 15 分钟',
      cookedAt: '2026-11-03',
      timesCooked: 3,
      method:
        '西兰花掰小朵，盐水泡一下赶小虫。\n水开下锅，焯到变翠绿就捞出过冷水。\n蒜末小火炒香，倒西兰花快速颠匀，盐和几滴蚝油就够。',
      pits: ['焯太久就会发黄，断生就好。'],
      tags: [
        { label: '快手', kind: 'plain' },
        { label: '翠绿', kind: 'ok' },
      ],
      isDraft: false,
      isSignature: false,
      toRetry: false,
      shared: false,
      loved: false,
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-11-03T12:10:00.000Z',
    },
    {
      id: 'noodles',
      name: '葱油拌面',
      photos: [publicUrl('food/noodles.jpg'), publicUrl('food/asian-noodles.jpg')],
      duration: '约 25 分钟',
      cookedAt: '2026-10-30',
      timesCooked: 2,
      method:
        '小葱切段，热油浇上去听一声响。\n生抽、老抽、糖、醋调一勺汁。\n面煮到刚好，沥干拌匀，浇葱油。',
      pits: ['葱花别炸太久，焦了会苦。'],
      tags: [
        { label: '家常', kind: 'plain' },
        { label: '别过火', kind: 'pit' },
      ],
      isDraft: false,
      isSignature: false,
      toRetry: true,
      shared: false,
      loved: false,
      createdAt: '2026-10-02T19:00:00.000Z',
      updatedAt: '2026-10-30T19:40:00.000Z',
    },
    {
      id: 'stew',
      name: '番茄牛腩炖土豆',
      photos: [publicUrl('food/stew.jpg'), publicUrl('food/chinese-food.jpg')],
      duration: '约 90 分钟',
      cookedAt: '2026-11-04',
      timesCooked: 4,
      method:
        '牛腩切块焯水，撇去浮沫。\n番茄炒出沙，下牛腩和热水，小火炖到软。\n土豆后下，收汁前再煮 15 分钟，免得煮化。',
      pits: ['土豆一定后下，不然先炖化成泥。'],
      tags: [
        { label: '拿手', kind: 'ok' },
        { label: '有踩坑', kind: 'pit' },
      ],
      isDraft: false,
      isSignature: true,
      toRetry: true,
      shared: false,
      loved: true,
      createdAt: '2026-08-18T11:00:00.000Z',
      updatedAt: '2026-11-04T20:00:00.000Z',
    },
  ]
}
