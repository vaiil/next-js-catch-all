export function getRouteRegex(
  normalizedRoute: string
): { re: RegExp; groups: { [groupName: string]: number } } {
  // Escape all characters that could be considered RegEx
  const escapedRoute = (normalizedRoute.replace(/\/$/, '') || '/').replace(
    /[|\\{}()[\]^$+*?.-]/g,
    '\\$&'
  )

  const groups: { [groupName: string]: number } = {}
  let groupIndex = 1

  let parameterizedRoute = escapedRoute.replace(
    /\/\\\[([^\/]+?)\\\](?=\/|$)/g,
    (_, $1) => (
      (groups[
        $1
          // Un-escape key
          .replace(/\\([|\\{}()[\]^$+*?.-])/g, '$1')
      ] = groupIndex++),
      '/([^/]+?)'
    )
  )

  const groupNames = Object.keys(groups);
  const lastGroup = groupNames[groupNames.length - 1];
  if (lastGroup && lastGroup[lastGroup.length - 1] === '*') {
    parameterizedRoute =
        parameterizedRoute.slice(0, parameterizedRoute.lastIndexOf('([^/]+?)')) +
        '(.*)';
    const value = groups[lastGroup];
    delete groups[lastGroup];
    groups[lastGroup.slice(0, -1)] = value;
  }

  return {
    re: new RegExp('^' + parameterizedRoute + '(?:/)?$', 'i'),
    groups,
  }
}
