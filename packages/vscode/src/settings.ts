export interface QraExtensionSettings {
  enableExperimentalFeatures: boolean;
}

export function getQraSettings(): QraExtensionSettings {
  return {
    enableExperimentalFeatures: false
  };
}

