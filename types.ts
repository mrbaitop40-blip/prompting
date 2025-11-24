
export interface Character {
  id: string;
  race: string;
  customRace: string;
  gender: string;
  age: string;
  outfit: string;
  hairstyle: string;
  voice: string;
  description: string;
  imagePreviewUrl: string | null;
  isAnalyzing?: boolean;
  lookAtCamera: boolean;
}

export interface Dialogue {
  id: string;
  characterId: string;
  text: string;
}

export interface Environment {
  description: string;
  lighting: string;
  cameraAngle: string;
  shotType: string;
  cameraMovement: string;
  style: string;
}
