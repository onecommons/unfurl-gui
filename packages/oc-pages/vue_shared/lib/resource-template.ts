export function constraintTypeFromRequirement(requirement: string | {constraint?: {resourceType?: string}} | null | undefined) {
  let constraintType: string | undefined
  if(typeof requirement != 'string') { constraintType = requirement?.constraint?.resourceType
  } else { constraintType  = requirement }

  return constraintType
}
