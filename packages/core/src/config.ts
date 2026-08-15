export interface QraConfig {
  maxTokensPerQuery?: number;
  maxFilesPerQuery?: number;
}

export const defaultConfig: QraConfig = {
  maxTokensPerQuery: 8000,
  maxFilesPerQuery: 50
};

