import {
  findModuleByKey,
  createModule
} from '../repositories/mvp-analytics.repository.js';

import {
  createModuleDataFromMVP
} from '../factories/mvp-module.factory.js';

import {
  calculateModuleAnalytics
} from '../mvp-analytics.service.js';

class MVPModuleAlreadyExistsError extends Error {
  constructor(module) {
    super('Module with this key already exists');
    this.name = 'MVPModuleAlreadyExistsError';
    this.module = module;
  }
}

class MVPAnalyticsNotFoundError extends Error {
  constructor() {
    super('No tracking data found for this MVP');
    this.name = 'MVPAnalyticsNotFoundError';
  }
}

/**
 * Crear un módulo de plataforma desde un MVP.
 */
async function createModuleFromValidatedMVP({
  moduleKey,
  autoActivate = false,
  copyPreviewConfig = true,
  initialStatus = 'testing'
}) {
  const existingModule = await findModuleByKey(moduleKey);

  if (existingModule) {
    throw new MVPModuleAlreadyExistsError(existingModule);
  }

  const analytics = await calculateModuleAnalytics(
    moduleKey,
    '30d'
  );

  if (!analytics) {
    throw new MVPAnalyticsNotFoundError();
  }

  const moduleData = createModuleDataFromMVP({
    moduleKey,
    analytics,
    autoActivate,
    copyPreviewConfig,
    initialStatus
  });

  const module = await createModule(moduleData);

  return {
    module,
    analytics,
    message: `Module created successfully from MVP ${moduleKey}`,
    next_steps: [
      'Configure pricing in module settings',
      'Add detailed description and screenshots',
      'Set validation targets',
      'Activate module when ready'
    ]
  };
}

export {
  createModuleFromValidatedMVP,
  MVPModuleAlreadyExistsError,
  MVPAnalyticsNotFoundError
};