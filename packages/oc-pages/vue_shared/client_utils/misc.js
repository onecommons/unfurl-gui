export function sleep(period) {
    return new Promise(resolve => setTimeout(resolve, period))
}

export const deepFreeze = obj => {
  Object.keys(obj).forEach(prop => {
    if (obj[prop] && typeof obj[prop] === 'object') deepFreeze(obj[prop]);
  });
  return Object.freeze(obj);
};
