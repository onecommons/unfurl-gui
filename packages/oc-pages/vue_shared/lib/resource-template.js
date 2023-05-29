export function constraintTypeFromRequirement(requirement) {
  let constraintType
  if(typeof requirement != 'string') { constraintType = requirement?.constraint?.resourceType
  } else { constraintType  = requirement }

  return constraintType
}
