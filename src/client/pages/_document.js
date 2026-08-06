import Document, { Html, Head, Main, NextScript } from 'next/document'

// Disable onContextMenu, except in development
const onContextMenu = process.env.NODE_ENV === 'development'
  ? ''
  : 'document.oncontextmenu = (e) => e.preventDefault()'

class MyDocument extends Document {
  static async getInitialProps (ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render () {
    return (
      <Html lang='en' data-fx-crt='true' data-fx-crt-text='false' data-fx-crt-text-animated='false' data-text-glow='true' data-local-time='false'>
        <Head>
          <link rel='manifest' href='/manifest.json' />
          <link rel='apple-touch-icon' izes='180x180' href='/icons/icon-180x180.png' />
          <meta name='theme-color' content='#000' />
          <style dangerouslySetInnerHTML={{
            __html: 'html { background: black; }'
          }}
          />
          <script dangerouslySetInnerHTML={{ __html: onContextMenu }} />
        </Head>
        <body className='not-selectable'>
          <div dangerouslySetInnerHTML={{
            __html: `
            <!-- SVG filters and effects used for styling icons (e.g. sytem map) -->
    <svg style="position: absolute; height: 0; margin: 0; padding: 0; top: -100px;">
      <defs>
        <!-- For planet icons in system map -->
        <clipPath id="svg-clip-path__planet">
          <rect x="400" y="0" width="500" height="1000" />
        </clipPath>
        <!-- Unknown system objects (eg stations, megaships)-->
        <linearGradient id="svg-gradient__unknown">
          <stop offset="0%" stop-color="#ccc" />
          <stop offset="100%" stop-color="#aaa" />
        </linearGradient>
        <!-- Planets -->
        <linearGradient id="system-map-svg-gradient__planet-ring" gradientTransform="rotate(90)" gradientUnits="userSpaceOnUse">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet" gradientTransform="rotate(10)">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--gas-giant">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--gas-giant-ammonia">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--rocky">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--rocky-icy">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--icy">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--high-metal">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--metal-rich">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--earth-like">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <linearGradient id="system-map-svg-gradient__planet--landable">
          <stop offset="0%" />
          <stop offset="100%" />
        </linearGradient>
        <radialGradient id="system-map-svg-gradient__planet--atmosphere--radial">
          <stop offset="25%" />
          <stop offset="50%" />
          <stop offset="100%" />
        </radialGradient>
        <linearGradient id="system-map-svg-gradient__planet--atmosphere" gradientTransform="rotate(10)">
          <stop offset="50%" />
          <stop offset="100%" />
        </linearGradient>
        <!-- Shadows on planets  -->
        <filter id="svg-filter__planet-shadow">
          <feOffset dx="-500" dy="-500"/>
          <feGaussianBlur stdDeviation="200" result="offset-blur"/>
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
          <feFlood flood-color="black" flood-opacity="1" result="color"/>
          <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
          <feComponentTransfer in="shadow" result="shadow"><feFuncA type="linear" slope=".7"/></feComponentTransfer>
          <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
        </filter>
        <filter id="svg-filter__planet-shadow--small">
          <feOffset dx="-200" dy="-200"/>
          <feGaussianBlur stdDeviation="100" result="offset-blur"/>
          <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
          <feFlood flood-color="black" flood-opacity="1" result="color"/>
          <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
          <feComponentTransfer in="shadow" result="shadow"><feFuncA type="linear" slope=".7"/></feComponentTransfer>
          <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
        </filter>
        <!--
          A star is drawn as a flat coloured disc with this texture over it and
          a glow behind, so it needs no filters and looks the same everywhere.
          The tile is centred on the star, as a star sits at 0,0 and spans 2000
          either side, so a tile starting at 0,0 would run its edge through the
          middle of every star.
        -->
        <pattern id="svg-pattern__star-surface" patternUnits="userSpaceOnUse" x="-2048" y="-2048" width="4096" height="4096">
          <image href="/images/textures/star.jpg" x="0" y="0" width="4096" height="4096"/>
        </pattern>
        <radialGradient id="svg-gradient__star-glow">
          <stop offset="0%" stop-color="#fff" stop-opacity=".55"/>
          <stop offset="82%" stop-color="#fff" stop-opacity=".55"/>
          <stop offset="93%" stop-color="#fff" stop-opacity=".14"/>
          <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <!--
          Fades the glow out from the edge of the star. A star is always drawn
          at the centre of its own view box, so this is in the same coordinates.
        -->
        <mask id="svg-mask__star-glow" maskUnits="userSpaceOnUse" x="-2500" y="-2500" width="5000" height="5000">
          <circle cx="0" cy="0" r="2450" fill="url(#svg-gradient__star-glow)"/>
        </mask>
      </defs>
    </svg>
    <script>
      const isChromium = window.chrome
      const isOpera = typeof window.opr !== "undefined"
      const isIEedge = window.navigator.userAgent.indexOf('Edg') > -1
      const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1
      const isIOSChrome = window.navigator.userAgent.match('CriOS')
      const isIOSFirefox = window.navigator.userAgent.match('FxiOS')
      const isSafari = navigator.vendor.match(/apple/i) 
        && !isIOSChrome && !isIOSFirefox
        && !navigator.userAgent.match(/Opera|OPT\\//)

      // Google Chrome supports filters on SVG textures in this way but not all
      // imitation Chrome browsers do and some look terrible as a result because
      // of how the fail at rendering.
      // 
      // Firefox supports this feature too, though doesn't support focus events
      // on the SVGs so the map view isn't actually interactive on Firefox.
      //
      // This check is all so the map doesn't look bad on cheap tablets like the
      // Amazon Fire, which Amazon recently forceably purged side loaded Google
      // Chrome from and replaced it with less capeable version of Amazon's 
      // Silk browser which uses Google Inc. as the vendor name but isn't
      // actually from Google and it does not have feature parity with Chrome.
      let ENABLE_PLANET_TEXTURES = false

      // WebKit renders the textures themselves correctly, it is only filters on
      // SVG elements it has trouble with, so it is included here. Stars no
      // longer use filters at all; planet surfaces still do, and the Safari
      // stylesheet compensates for those.
      const isWebKit = isSafari || isIOSChrome || isIOSFirefox

      if (isIEedge || (isFirefox && !isIOSFirefox) || isWebKit) {
        ENABLE_PLANET_TEXTURES = true
      } else if (
        // Check is Google Chrome (and not impostor)
        isChromium !== null &&
        window.navigator.vendor === "Google Inc." &&
        !window.navigator.userAgent.match("like Chrome") && // Browsers like Amazon Fire's Silk Browsers use the Google Inc. vendor name, but that's a lie and it doesn't support this feature
        isOpera === false &&
        isIEedge === false
      ) {
        ENABLE_PLANET_TEXTURES = true
      }

      // Exposed so styles can adapt to it, and so it can be read when working
      // out why a device renders the map the way it does
      document.documentElement.dataset.planetTextures = ENABLE_PLANET_TEXTURES

      if (ENABLE_PLANET_TEXTURES) {
        document.write(\`
          <svg style="position: absolute; height: 0; margin: 0; padding: 0; top: -100px;">
            <defs>
              <pattern id="svg-pattern__planet-surface" patternUnits="userSpaceOnUse" preserveAspectRatio="none" width="4096" height="4096">
                <image href="/images/textures/rock.jpg" x="0" y="0" width="4096" height="4096"/>
              </pattern>
              <pattern id="svg-pattern__planet-surface-animated" x="0" patternUnits="userSpaceOnUse" preserveAspectRatio="none" width="4096" height="4096">
                <image href="/images/textures/rock.jpg" x="0" y="0" width="4096" height="4096"/>
                <animate attributeName="x" values="0;4096" dur="30s" repeatCount="indefinite"/>
              </pattern>
              <pattern id="svg-pattern__planet-surface--clouds" patternUnits="userSpaceOnUse" preserveAspectRatio="none" width="4096" height="4096">
                <image href="/images/textures/clouds.jpg" x="0" y="0" width="4096" height="4096"/>
              </pattern>
              <pattern id="svg-pattern__planet-surface--gas-giant" patternUnits="userSpaceOnUse" preserveAspectRatio="none" width="4096" height="4096">
                <image href="/images/textures/gas-giant.jpg" x="0" y="0" width="4096" height="4096"/>
              </pattern>
            </defs>
          </svg>
        \`)
      }
    </script>
          `
          }}
          />
          <div className='layout__background' />
          <div className='layout__overlay' />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
