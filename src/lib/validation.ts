// Validation utilities for Kandel parameters

export function validateStepSize(
  stepSize: number,
  pricePoints: number
): string | null {
  if (stepSize < 1) return 'Step size must be larger than 1';
  if (stepSize >= pricePoints)
    return `Step size must be less than ${Math.max(pricePoints - 1, 1)}`;
  return null;
}

export function validateLevelsPerSide(levels: string): string | null {
  if (!levels.trim()) {
    return 'Levels per side is required';
  }

  const levelsInt = parseInt(levels);
  if (!isFinite(levelsInt) || levelsInt <= 0) {
    return 'Levels per side must be a positive number';
  }

  return null;
}

export function validateGasreq(gasreq: string): string | null {
  if (!gasreq.trim()) {
    return 'Gas requirement is required';
  }

  const gasreqInt = parseInt(gasreq);
  if (!isFinite(gasreqInt) || gasreqInt <= 0) {
    return 'Gas requirement must be a positive number';
  }

  // Check uint24 bounds (0 to 16,777,215)
  if (gasreqInt > 16777215) {
    return 'Gas requirement exceeds uint24 maximum (16,777,215)';
  }

  return null;
}

// Unified validation functions for the new edit form approach
export function validateMinMax(
  minPrice: number,
  maxPrice: number
): string | null {
  if (minPrice <= 0) {
    return 'Min price must be greater than 0';
  }
  if (maxPrice <= minPrice) {
    return 'Max price must be greater than min price';
  }
  return null;
}

export function validateStep(step: number, pricePoints: number): string | null {
  if (step < 1) {
    return 'Step must be greater than or equal to 1';
  }
  if (step >= pricePoints) {
    return 'Step must be less than price points';
  }
  return null;
}

export function validateGasreqNumber(gasreq: number): string | null {
  if (gasreq <= 0) {
    return 'Gas requirement must be positive';
  }
  if (gasreq > 16777215) {
    return 'Gas requirement exceeds uint24 maximum (16,777,215)';
  }
  return null;
}

export function validatePrice(
  price: string,
  fieldName: string,
  minPrice?: number,
  maxPrice?: number
): string | null {
  if (!price.trim()) {
    return `${fieldName} is required`;
  }

  const priceFloat = parseFloat(price);
  if (!isFinite(priceFloat) || priceFloat <= 0) {
    return `${fieldName} must be a positive number`;
  }

  // Additional constraints based on context
  if (minPrice !== undefined && priceFloat <= minPrice) {
    return `${fieldName} must be greater than ${minPrice}`;
  }

  if (maxPrice !== undefined && priceFloat >= maxPrice) {
    return `${fieldName} must be less than ${maxPrice}`;
  }

  return null;
}

export function validateMinPrice(minPrice: string): string | null {
  return validatePrice(minPrice, 'Min price');
}

export function validateMaxPrice(
  maxPrice: string,
  minPrice: string
): string | null {
  const minPriceFloat = parseFloat(minPrice);
  const validation = validatePrice(maxPrice, 'Max price', minPriceFloat);

  if (validation) return validation;

  const maxPriceFloat = parseFloat(maxPrice);
  if (isFinite(minPriceFloat) && maxPriceFloat <= minPriceFloat) {
    return 'Max price must be greater than min price';
  }

  return null;
}

export function validateTokenAmount(
  amount: string,
  tokenSymbol: string
): string | null {
  if (!amount.trim()) {
    return `${tokenSymbol} amount is required`;
  }

  const amountFloat = parseFloat(amount);
  if (!isFinite(amountFloat) || amountFloat <= 0) {
    return `${tokenSymbol} amount must be a positive number`;
  }

  return null;
}

// Combined validation for the More Actions modal
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateAction(
  action: string,
  value: string,
  context?: {
    levelsPerSide?: string;
    minPrice?: string;
    maxPrice?: string;
    tokenSymbol?: string;
  }
): ValidationResult {
  let error: string | null = null;

  switch (action) {
    case 'levels':
      error = validateLevelsPerSide(value);
      break;
    case 'step':
      if (context?.levelsPerSide) {
        const levels = parseInt(context.levelsPerSide);
        const step = parseInt(value);
        const pricePoints = levels * 2;
        error = validateStepSize(step, pricePoints);
      } else {
        error = 'Levels per side required for step validation';
      }
      break;
    case 'gasreq':
      error = validateGasreq(value);
      break;
    case 'minPrice':
      error = validateMinPrice(value);
      break;
    case 'maxPrice':
      error = validateMaxPrice(value, context?.minPrice || '');
      break;
    case 'depositBase':
    case 'depositQuote':
      error = validateTokenAmount(value, context?.tokenSymbol || 'Token');
      break;
    default:
      error = 'Unknown action type';
  }

  return {
    isValid: error === null,
    error: error || undefined,
  };
}
