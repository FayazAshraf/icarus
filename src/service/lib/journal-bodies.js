// Builds bodies from the local journal, in the same shape EDSM returns them.
//
// EDSM only knows about systems that someone has visited *and* uploaded, so in
// undiscovered systems it returns no bodies at all and the Navigation panel has
// nothing to draw - even though the player has just scanned the system and the
// data is sat in their journal. This maps `Scan` events into EDSM shaped bodies
// so they can be used to fill in what EDSM is missing.
//
// See: https://github.com/iaincollins/icarus/issues/85

const SOLAR_RADIUS_IN_METRES = 696340000
const ASTRONOMICAL_UNIT_IN_METRES = 149597870700
const METRES_PER_SECOND_SQUARED_IN_G = 9.80665
const PASCALS_IN_AN_ATMOSPHERE = 101325
const SECONDS_IN_A_DAY = 86400

// The UI keys off the names EDSM uses (e.g. to pick the texture for a planet or
// to count how many Earth-like worlds are in a system) so journal values have
// to be translated rather than passed through.
const PLANET_SUB_TYPES = {
  'Metal rich body': 'Metal-rich body',
  'High metal content body': 'High metal content world',
  'Rocky body': 'Rocky body',
  'Icy body': 'Icy body',
  'Rocky ice body': 'Rocky Ice world',
  'Earthlike body': 'Earth-like world',
  'Water world': 'Water world',
  'Ammonia world': 'Ammonia world',
  'Water giant': 'Water giant',
  'Water giant with life': 'Water giant with life',
  'Gas giant with water based life': 'Gas giant with water-based life',
  'Gas giant with ammonia based life': 'Gas giant with ammonia-based life',
  'Sudarsky class I gas giant': 'Class I gas giant',
  'Sudarsky class II gas giant': 'Class II gas giant',
  'Sudarsky class III gas giant': 'Class III gas giant',
  'Sudarsky class IV gas giant': 'Class IV gas giant',
  'Sudarsky class V gas giant': 'Class V gas giant',
  'Helium rich gas giant': 'Helium-rich gas giant',
  'Helium gas giant': 'Helium gas giant'
}

// The map draws a star using the first character of the sub type and the
// spectral class (e.g. 'K (Yellow-Orange) Star' + 'K1' renders as
// 'K1 (Yellow-Orange) Star') so these have to keep EDSM's wording.
const STAR_SUB_TYPES = {
  O: 'O (Blue-White) Star',
  B: 'B (Blue-White) Star',
  B_BlueWhiteSuperGiant: 'B (Blue-White super giant) Star',
  A: 'A (Blue-White) Star',
  A_BlueWhiteSuperGiant: 'A (Blue-White super giant) Star',
  F: 'F (White) Star',
  F_WhiteSuperGiant: 'F (White super giant) Star',
  G: 'G (White-Yellow) Star',
  G_WhiteSuperGiant: 'G (White-Yellow super giant) Star',
  K: 'K (Yellow-Orange) Star',
  K_OrangeGiant: 'K (Yellow-Orange giant) Star',
  M: 'M (Red dwarf) Star',
  M_RedGiant: 'M (Red giant) Star',
  M_RedSuperGiant: 'M (Red super giant) Star',
  L: 'L (Brown dwarf) Star',
  T: 'T (Brown dwarf) Star',
  Y: 'Y (Brown dwarf) Star',
  TTS: 'T Tauri Star',
  AeBe: 'Herbig Ae/Be Star',
  W: 'Wolf-Rayet Star',
  WN: 'Wolf-Rayet N Star',
  WNC: 'Wolf-Rayet NC Star',
  WC: 'Wolf-Rayet C Star',
  WO: 'Wolf-Rayet O Star',
  CS: 'CS Star',
  C: 'C Star',
  CN: 'CN Star',
  CJ: 'CJ Star',
  CH: 'CH Star',
  CHd: 'CHd Star',
  MS: 'MS-type Star',
  S: 'S-type Star',
  D: 'White Dwarf (D) Star',
  DA: 'White Dwarf (DA) Star',
  DAB: 'White Dwarf (DAB) Star',
  DAO: 'White Dwarf (DAO) Star',
  DAZ: 'White Dwarf (DAZ) Star',
  DAV: 'White Dwarf (DAV) Star',
  DB: 'White Dwarf (DB) Star',
  DBZ: 'White Dwarf (DBZ) Star',
  DBV: 'White Dwarf (DBV) Star',
  DO: 'White Dwarf (DO) Star',
  DOV: 'White Dwarf (DOV) Star',
  DQ: 'White Dwarf (DQ) Star',
  DC: 'White Dwarf (DC) Star',
  DCV: 'White Dwarf (DCV) Star',
  DX: 'White Dwarf (DX) Star',
  N: 'Neutron Star',
  H: 'Black Hole',
  SupermassiveBlackHole: 'Supermassive Black Hole',
  X: 'Exotic Star',
  RoguePlanet: 'Rogue Planet',
  Nebula: 'Nebula',
  StellarRemnantNebula: 'Stellar Remnant Nebula'
}

const RING_TYPES = {
  eRingClass_Icy: 'Icy',
  eRingClass_Rocky: 'Rocky',
  eRingClass_MetalRich: 'Metal Rich',
  eRingClass_Metalic: 'Metallic',
  eRingClass_Metallic: 'Metallic'
}

const TERRAFORMING_STATES = {
  Terraformable: 'Candidate for terraforming',
  Terraforming: 'Terraforming',
  Terraformed: 'Terraformed'
}

// EDSM gives every body a unique 64 bit id. There isn't one in the journal, but
// a system address plus a body id is unique in the same way, and this value is
// only ever used as a key to de-duplicate bodies with.
function bodyId64 (Scan) {
  return `${Scan.SystemAddress}-${Scan.BodyID}`
}

function ringsFromScan (Scan) {
  if (!Scan?.Rings?.length) return undefined
  return Scan.Rings.map(ring => ({
    name: ring.Name,
    type: RING_TYPES[ring.RingClass] ?? ring.RingClass,
    mass: ring.MassMT,
    innerRadius: ring.InnerRad,
    outerRadius: ring.OuterRad
  }))
}

// Journal composition values are fractions, EDSM uses percentages
function compositionFromScan (composition) {
  if (!composition) return undefined
  const percentages = {}
  Object.entries(composition).forEach(([name, fraction]) => {
    percentages[name] = fraction * 100
  })
  return percentages
}

function namedPercentagesFromScan (values) {
  if (!values?.length) return undefined
  const percentages = {}
  values.forEach(({ Name, Percent }) => { percentages[Name] = Percent })
  return percentages
}

function starFromScan (Scan) {
  return {
    subType: STAR_SUB_TYPES[Scan.StarType] ?? `${Scan.StarType} Star`,
    spectralClass: Scan.Subclass !== undefined ? `${Scan.StarType}${Scan.Subclass}` : Scan.StarType,
    luminosity: Scan.Luminosity,
    absoluteMagnitude: Scan.AbsoluteMagnitude,
    solarMasses: Scan.StellarMass,
    solarRadius: Scan.Radius / SOLAR_RADIUS_IN_METRES,
    age: Scan.Age_MY,
    isScoopable: ['O', 'B', 'A', 'F', 'G', 'K', 'M'].includes(Scan.StarType)
  }
}

function planetFromScan (Scan) {
  return {
    subType: PLANET_SUB_TYPES[Scan.PlanetClass] ?? Scan.PlanetClass,
    isLandable: Scan.Landable ?? false,
    gravity: Scan.SurfaceGravity !== undefined ? Scan.SurfaceGravity / METRES_PER_SECOND_SQUARED_IN_G : undefined,
    earthMasses: Scan.MassEM,
    radius: Scan.Radius !== undefined ? Scan.Radius / 1000 : undefined, // EDSM uses km
    surfacePressure: Scan.SurfacePressure !== undefined ? Scan.SurfacePressure / PASCALS_IN_AN_ATMOSPHERE : undefined,
    volcanismType: Scan.Volcanism === '' ? 'No volcanism' : Scan.Volcanism,
    atmosphereType: Scan.AtmosphereType,
    atmosphereComposition: namedPercentagesFromScan(Scan.AtmosphereComposition),
    solidComposition: compositionFromScan(Scan.Composition),
    materials: namedPercentagesFromScan(Scan.Materials),
    terraformingState: TERRAFORMING_STATES[Scan.TerraformState] ?? 'Not terraformable',
    isTidallyLocked: Scan.TidalLock,
    reserveLevel: Scan.ReserveLevel
  }
}

// Bodies that are neither a star nor a planet (e.g. belt clusters) are not
// returned by EDSM and can't be drawn on the map, so are skipped.
function bodyFromScan (Scan) {
  if (!Scan.StarType && !Scan.PlanetClass) return null

  const body = {
    // The UI uses the id to draw a body (a star isn't drawn without one) and to
    // key elements on the page, so bodies from the logs need one of their own
    id: bodyId64(Scan),
    id64: bodyId64(Scan),
    bodyId: Scan.BodyID,
    name: Scan.BodyName,
    type: Scan.StarType ? 'Star' : 'Planet',
    parents: Scan.Parents,
    distanceToArrival: Scan.DistanceFromArrivalLS,
    isMainStar: Scan.StarType ? Scan.BodyID === 0 : undefined,
    surfaceTemperature: Scan.SurfaceTemperature,
    orbitalPeriod: Scan.OrbitalPeriod !== undefined ? Scan.OrbitalPeriod / SECONDS_IN_A_DAY : undefined,
    rotationalPeriod: Scan.RotationPeriod !== undefined ? Scan.RotationPeriod / SECONDS_IN_A_DAY : undefined,
    semiMajorAxis: Scan.SemiMajorAxis !== undefined ? Scan.SemiMajorAxis / ASTRONOMICAL_UNIT_IN_METRES : undefined,
    orbitalEccentricity: Scan.Eccentricity,
    orbitalInclination: Scan.OrbitalInclination,
    argOfPeriapsis: Scan.Periapsis,
    axialTilt: Scan.AxialTilt,
    rings: ringsFromScan(Scan),
    discovery: { date: Scan.timestamp },
    _fromJournal: true, // Flag so it's clear in the API where this data came from
    ...(Scan.StarType ? starFromScan(Scan) : planetFromScan(Scan))
  }

  // Strip properties we don't have a value for, so they don't show up in the
  // UI as empty fields
  Object.keys(body).forEach(key => { if (body[key] === undefined) delete body[key] })

  return body
}

// Returns every body the player has scanned in a system, most recent scan of
// each body winning if a body has been scanned more than once.
async function getBodiesFromJournal (eliteLog, systemName) {
  if (!eliteLog || !systemName) return []

  // Sorted newest first, so the first scan seen of a body is the one to keep
  const scans = await eliteLog._query({ event: 'Scan', StarSystem: systemName })

  const bodiesByBodyId = {}
  for (const Scan of scans) {
    if (Scan.BodyID === undefined || bodiesByBodyId[Scan.BodyID]) continue
    const body = bodyFromScan(Scan)
    if (body) bodiesByBodyId[Scan.BodyID] = body
  }

  return Object.values(bodiesByBodyId).sort((a, b) => a.bodyId - b.bodyId)
}

module.exports = { getBodiesFromJournal, bodyFromScan }
