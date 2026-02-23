export interface DesignDirection {
  theme: 'dark' | 'light';
  accentColor: string;    // hex 색상코드 예: '#4CAF50'
  keyCopy: string;        // 메인 헤드라인 1줄
  subCopy: string;        // 서브 문구
  keyPoints: string[];    // 핵심 포인트 2~3개
  mood: 'serious' | 'bright' | 'urgent';
}

export interface IDirectorService {
  analyze(script: string): Promise<DesignDirection>;
}
