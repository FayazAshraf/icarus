const EDSM = require('../edsm')
const SystemMap = require('../system-map')
const { getBodiesFromJournal } = require('../journal-bodies')
const { UNKNOWN_VALUE } = require('../../../shared/consts')
const distance = require('../../../shared/distance')

const SAMPLES_TO_COMPLETE = 3 // Samples needed to complete a biological species

class System {
  constructor ({ eliteLog }) {
    this.eliteLog = eliteLog
    return this
  }

  async getCurrentLocation () {
    // Get most recent Location event (written at startup and after respawn)
    const Location = await this.eliteLog.getEvent('Location')

    const currentLocation = {
      name: UNKNOWN_VALUE, // System Name
      mode: 'SHIP' // ENUM: [SHIP|SRV|FOOT|TAXI|MULTICREW]
    }

    if (!Location) return currentLocation

    const FSDJump = (await this.eliteLog.getEventsFromTimestamp('FSDJump', Location?.timestamp, 1))?.[0]

    // If there is an FSD Jump event more recent than the Location event
    // then use that for current location (note: they are formatted almost
    // the same way)
    const event = FSDJump || Location

    if (event.StarSystem) currentLocation.name = event.StarSystem
    if (event.StarPos) currentLocation.position = event.StarPos
    if (event.SystemAddress) currentLocation.address = event.SystemAddress

    if (event.InSRV) currentLocation.mode = 'SRV'
    if (event.OnFoot) currentLocation.mode = 'FOOT'
    if (event.Taxi) currentLocation.mode = 'TAXI'
    if (event.Multicrew) currentLocation.mode = 'MULTICREW'

    // Station is only set if docked
    if (event.Docked) currentLocation.docked = true
    if (event.StationName) currentLocation.station = event.StationName

    // Body can be a star or a planet
    if (event.Body) currentLocation.body = event.Body
    if (event.BodyType) currentLocation.bodyType = event.BodyType

    // Set if on (or near) a planet
    if (event.Latitude) currentLocation.latitude = event.Latitude
    if (event.Longitude) currentLocation.longitude = event.Longitude
    if (event.Altitude) currentLocation.altitude = event.Altitude

    // System information
    if (event.SystemAllegiance) currentLocation.allegiance = event.SystemAllegiance
    if (event.SystemGovernment_Localised || event.SystemGovernment) currentLocation.government = event.SystemGovernment_Localised || event.SystemGovernment
    if (event.SystemSecurity_Localised || event.SystemSecurity) currentLocation.government = event.SystemSecurity_Localised || event.SystemSecurity
    if (event.Population) currentLocation.population = event.Population
    if (event?.SystemFaction?.Name) currentLocation.faction = event.SystemFaction.Name
    if (event?.SystemFaction?.FactionState) currentLocation.state = event.SystemFaction.FactionState
    if (event.SystemEconomy_Localised || event.SystemEconomy) {
      currentLocation.economy = {
        primary: event.SystemEconomy_Localised || event.SystemEconomy
      }
      if (event.SystemSecondEconomy_Localised || event.SystemSecondEconomy) {
        currentLocation.economy.secondary = event.SystemSecondEconomy_Localised || event.SystemSecondEconomy
      }
    }

    // Not setting this until there is code to also work out when it has been cleared
    // if (event.Wanted) currentLocation.wanted = event.true

    return currentLocation
  }

  // Some events only identify a system by address, so we need to be able to
  // resolve one from a system name to find them
  async getSystemAddress (systemName, currentLocation = null) {
    if (systemName.toLowerCase() === currentLocation?.name?.toLowerCase() && currentLocation?.address) {
      return currentLocation.address
    }

    const cachedAddress = global.CACHE.SYSTEMS[systemName.toLowerCase()]?.address
    if (cachedAddress && cachedAddress !== UNKNOWN_VALUE) return cachedAddress

    const [Scan] = await this.eliteLog._query({ event: 'Scan', StarSystem: systemName }, 1)
    return Scan?.SystemAddress ?? null
  }

  // Progress collecting biological samples on a body, keyed by genus. Three
  // samples complete a species; the logs record the first as a 'Log', the
  // second and third as a 'Sample' and write an 'Analyse' once the set is
  // complete. Starting a new set on a species writes another 'Log', which
  // starts the count again.
  async getBiologicalSamples (systemAddress, bodyId) {
    const samplesByGenus = {}

    if (!systemAddress || systemAddress === UNKNOWN_VALUE) return samplesByGenus
    if (bodyId === undefined || bodyId === null) return samplesByGenus

    const scans = await this.eliteLog._query(
      { event: 'ScanOrganic', SystemAddress: systemAddress, Body: bodyId },
      0,
      { timestamp: 1 } // Oldest first, so samples are counted in the order taken
    )

    for (const scan of scans) {
      const genus = scan.Genus_Localised ?? scan.Genus
      if (!genus) continue

      if (!samplesByGenus[genus]) samplesByGenus[genus] = { samples: 0, complete: false }
      const progress = samplesByGenus[genus]

      if (scan.Species_Localised) progress.species = scan.Species_Localised

      switch (scan.ScanType) {
        case 'Log': // First sample of a set
          progress.samples = 1
          progress.complete = false
          break
        case 'Sample': // Second and third samples
          progress.samples = Math.min(progress.samples + 1, SAMPLES_TO_COMPLETE)
          break
        case 'Analyse': // Written once the third sample is taken
          progress.samples = SAMPLES_TO_COMPLETE
          progress.complete = true
          break
      }
    }

    return samplesByGenus
  }

  // Timestamp of the most recent event in the logs that changes what we know
  // about a system. Scans identify the system by name, but the events written
  // while surface scanning it only have a system address, so both are checked.
  async getLocalDataTimestamp (systemName, systemAddress = null) {
    const systemIdentifiers = [{ StarSystem: systemName }, { SystemName: systemName }]
    if (systemAddress && systemAddress !== UNKNOWN_VALUE) systemIdentifiers.push({ SystemAddress: systemAddress })

    const [mostRecentEvent] = await this.eliteLog._query({
      event: { $in: ['Scan', 'FSSDiscoveryScan', 'FSSAllBodiesFound', 'SAAScanComplete', 'FSSBodySignals', 'SAASignalsFound', 'ScanOrganic'] },
      $or: systemIdentifiers
    }, 1)

    return mostRecentEvent?.timestamp ?? null
  }

  async getSystem ({ name = null, useCache = true } = {}) {
    const currentLocation = await this.getCurrentLocation()

    // If no system name was specified, get the star system the player is in
    const systemName = name?.trim() ?? currentLocation?.name ?? null

    // If no system name was provided amd we don't know the players location
    if (!systemName || systemName === UNKNOWN_VALUE) {
      return {
        name: UNKNOWN_VALUE,
        unknownSystem: true
      }
    }

    // What we know about a system changes as the player scans it, so a cache
    // entry is only good for as long as there are no newer events for the
    // system in the logs. Without this a system cached before it was scanned
    // is served indefinitely (until the service is restarted) to anything that
    // doesn't explicitly ask to bypass the cache.
    const systemAddress = await this.getSystemAddress(systemName, currentLocation)
    const localDataTimestamp = await this.getLocalDataTimestamp(systemName, systemAddress)

    // Check for entry in cache in case we have it already
    // Note: System names are unique (they can change, but will still be unique)
    // so is okay to use them as a key.
    if (!global.CACHE.SYSTEMS[systemName.toLowerCase()] ||
        useCache === false ||
        global.CACHE.SYSTEMS[systemName.toLowerCase()]._localDataTimestamp !== localDataTimestamp) {
      // Get system from EDSM
      const system = await EDSM.system(systemName)

      // EDSM has no bodies for systems nobody has explored and uploaded yet, so
      // add in any bodies the player has scanned themselves. EDSM is left as
      // the source of truth for bodies it does know about.
      // See: https://github.com/iaincollins/icarus/issues/85
      //
      // TODO This merges whole bodies, not the values on them, so a body EDSM
      // already knows about keeps EDSM's data even where the local logs are
      // more recent (e.g. EDSM only has Full Spectrum Scan data for a body the
      // player has since surface scanned). Merging at the field level needs a
      // list of which values the logs own; the identity of a body (id, id64,
      // bodyId) has to stay EDSM's, as bodies built from the logs only have a
      // synthetic id64. Stations are not merged from local data at all yet.
      const bodiesFromJournal = await getBodiesFromJournal(this.eliteLog, systemName)
      if (bodiesFromJournal.length > 0) {
        if (!system.bodies) system.bodies = []
        // EDSM returns a null body id for the main star in some systems (the
        // same quirk SystemMap patches around) so treat that as body id 0,
        // otherwise we add the star a second time from the journal
        const bodyIdsFromEDSM = system.bodies.map(body => (body.type === 'Star' && body.bodyId === null) ? 0 : body.bodyId)
        system.bodies = system.bodies
          .concat(bodiesFromJournal.filter(body => !bodyIdsFromEDSM.includes(body.bodyId)))
          .sort((a, b) => a.bodyId - b.bodyId)

        // If EDSM doesn't know the system at all we can still name and place it
        // using the player's own logs
        if (system.name === UNKNOWN_VALUE) system.name = systemName
        if (system.address === UNKNOWN_VALUE && currentLocation?.address && systemName.toLowerCase() === currentLocation?.name?.toLowerCase()) {
          system.address = currentLocation.address
        }
        if (!system.position && currentLocation?.position && systemName.toLowerCase() === currentLocation?.name?.toLowerCase()) {
          system.position = currentLocation.position
        }
      }

      // Merge in local scan data with information about the body
      if (system?.bodies) {
        for (const body of system.bodies) {
          body.signals = {
            geological: 0,
            biological: 0,
            human: 0
          }
          
          // Merge in body signal scan data
          const FSSBodySignals = await this.eliteLog._query({ event: 'FSSBodySignals', BodyName: body.name }, 1)
          if (FSSBodySignals[0]?.Signals) {
            ;(FSSBodySignals[0]?.Signals).map(signal => {
              if (signal?.Type === '$SAA_SignalType_Geological;') {
                body.signals.geological = signal?.Count ?? 0
              }
              if (signal?.Type === '$SAA_SignalType_Biological;') {
                body.signals.biological = signal?.Count ?? 0
              }
              if (signal?.Type === '$SAA_SignalType_Human;') {
                body.signals.human = signal?.Count ?? 0
              }
            })
          }

          // Merge in surface scan data
          const SAASignalsFound = await this.eliteLog._query({ event: 'SAASignalsFound', BodyName: body.name }, 1)
          if (SAASignalsFound[0]?.Signals) {
            ;(SAASignalsFound[0]?.Signals).map(signal => {
              if (signal?.Type === '$SAA_SignalType_Geological;') {
                body.signals.geological = signal?.Count ?? 0
              }
              if (signal?.Type === '$SAA_SignalType_Biological;') {
                body.signals.biological = signal?.Count ?? 0
              }
              if (signal?.Type === '$SAA_SignalType_Human;') {
                body.signals.human = signal?.Count ?? 0
              }
            })
          }

          // If we have data from a surface scan about the plants, merge it
          if (body.signals.biological > 0 && SAASignalsFound[0]?.Genuses) {
            body.biologicalGenuses = []
            ;(SAASignalsFound[0]?.Genuses).map(biologicalSamples => {
              body.biologicalGenuses.push(biologicalSamples.Genus_Localised)
            })
          }

          // Merge in how far along we are collecting samples from each genus
          if (body.signals.biological > 0) {
            const biologicalSamples = await this.getBiologicalSamples(systemAddress, body.bodyId)
            if (Object.keys(biologicalSamples).length > 0) body.biologicalSamples = biologicalSamples
          }

          // Only log discovered / mapped if in an unhabited system
          // FIXME Suspect this logic isn't entirely correct
          const inhabitedSystem = (system?.population > 0 || system?.stations?.length > 0 || system?.ports?.length > 0 || system?.megaships?.length > 0 || system?.settlements?.length > 0)
          if (!inhabitedSystem) {
            const Scan = await this.eliteLog._query({ event: 'Scan', BodyName: body.name }, 1)
            body.discovered = Scan[0]?.WasDiscovered ?? false
            body.mapped = Scan[0]?.WasMapped ?? false

            // If there is an SAAScanComplete entry for the body, it has been scanned
            // (even if the Scan entry says it has not, because it's old data)
            const SAAScanComplete = await this.eliteLog._query({ event: 'SAAScanComplete', BodyName: body.name }, 1)
            if (SAAScanComplete[0]?.BodyName) body.mapped = true
          }
        }
      }


      // Generate map data from the system data
      const systemMap = new SystemMap(system)

      // Create/Update cache entry with merged system and system map data
      global.CACHE.SYSTEMS[systemName.toLowerCase()] = {
        ...system,
        ...systemMap,
        _localDataTimestamp: localDataTimestamp
      }
    }

    const cacheResponse = global.CACHE.SYSTEMS[systemName.toLowerCase()] // Get entry from cache

    // Determine how many bodies we actaully know of in the current system, and
    // how many we think there are based on FSS Discovery Scan
    let numberOfBodiesFound = cacheResponse?.bodies?.length ?? 0
    let numberOfBodiesInSystem = numberOfBodiesFound // We start with this value (until we know otherwise)
    let scanPercentComplete = null

    if (cacheResponse.name && cacheResponse.name !== UNKNOWN_VALUE) {
      // If we have an FSSDiscoveryScan result with a BodyCount then we can estimate
      // percentage of the system that has been scanned
      const FSSDiscoveryScan = await this.eliteLog._query({ event: 'FSSDiscoveryScan', SystemName: cacheResponse.name }, 1)
      if (FSSDiscoveryScan?.[0]?.BodyCount) {
        numberOfBodiesInSystem = FSSDiscoveryScan?.[0]?.BodyCount
        scanPercentComplete = Math.floor((numberOfBodiesFound / numberOfBodiesInSystem) * 100)
      }
    }

    // If we don't know what system this is return what we have
    if (!cacheResponse.name || cacheResponse.name === UNKNOWN_VALUE) {
      const isCurrentLocation = (systemName.toLowerCase() === currentLocation?.name?.toLowerCase())

      const response = {
        name: systemName,
        unknownSystem: true,
        isCurrentLocation,
        scanPercentComplete,
        _cacheTimestamp: new Date().toISOString()
      }

      if (isCurrentLocation && currentLocation?.position && currentLocation?.address) {
        response.position = currentLocation.position
        response.address = currentLocation.address
        response.distance = 0
      }

      return response
    }

    if (systemName.toLowerCase() === currentLocation?.name?.toLowerCase()) {
      // Handle if this is the system the player is currently in
      return {
        ...cacheResponse,
        ...currentLocation,
        distance: 0,
        isCurrentLocation: true,
        scanPercentComplete,
        _cacheTimestamp: new Date().toISOString()
      }

    } else {
      // Handle if this is not the system the player is currently in
      return {
        ...cacheResponse,
        distance: distance(cacheResponse?.position, currentLocation?.position),
        isCurrentLocation: false,
        scanPercentComplete,
        _cacheTimestamp: new Date().toISOString()
      }
    }
  }
}

module.exports = System
