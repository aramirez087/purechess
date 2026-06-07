export enum TimeCategory {
  Bullet = 'bullet',
  Blitz = 'blitz',
  Rapid = 'rapid',
  Classical = 'classical',
  Correspondence = 'correspondence',
}

export interface TimeControl {
  initialSeconds: number;
  incrementSeconds: number;
  category: TimeCategory;
  label: string;
}

export const TIME_CONTROL_PRESETS: Record<string, TimeControl> = {
  '1+0': { initialSeconds: 60, incrementSeconds: 0, category: TimeCategory.Bullet, label: '1 min' },
  '1+1': { initialSeconds: 60, incrementSeconds: 1, category: TimeCategory.Bullet, label: '1|1' },
  '2+1': { initialSeconds: 120, incrementSeconds: 1, category: TimeCategory.Bullet, label: '2|1' },
  '3+0': { initialSeconds: 180, incrementSeconds: 0, category: TimeCategory.Blitz, label: '3 min' },
  '3+2': { initialSeconds: 180, incrementSeconds: 2, category: TimeCategory.Blitz, label: '3|2' },
  '5+0': { initialSeconds: 300, incrementSeconds: 0, category: TimeCategory.Blitz, label: '5 min' },
  '5+3': { initialSeconds: 300, incrementSeconds: 3, category: TimeCategory.Blitz, label: '5|3' },
  '10+0': { initialSeconds: 600, incrementSeconds: 0, category: TimeCategory.Rapid, label: '10 min' },
  '10+5': { initialSeconds: 600, incrementSeconds: 5, category: TimeCategory.Rapid, label: '10|5' },
  '15+10': { initialSeconds: 900, incrementSeconds: 10, category: TimeCategory.Rapid, label: '15|10' },
  '30+0': { initialSeconds: 1800, incrementSeconds: 0, category: TimeCategory.Classical, label: '30 min' },
  '30+20': { initialSeconds: 1800, incrementSeconds: 20, category: TimeCategory.Classical, label: '30|20' },
};
