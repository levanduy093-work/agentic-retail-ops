import {
  ContainerRegistrationKeys,
  defineConfig,
  loadEnv,
  MedusaError,
  Modules,
} from '@medusajs/framework/utils'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const isGoogleAuthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID)
const isRedisInfrastructureEnabled =
  process.env.REDIS_INFRASTRUCTURE_ENABLED === 'true'
const redisUrl = process.env.REDIS_URL
const lockingRedisUrl = process.env.LOCKING_REDIS_URL || redisUrl

if (isRedisInfrastructureEnabled && !redisUrl) {
  throw new MedusaError(
    MedusaError.Types.INVALID_DATA,
    'REDIS_URL is required when REDIS_INFRASTRUCTURE_ENABLED=true'
  )
}

const productionInfrastructureModules = isRedisInfrastructureEnabled
  ? [
      {
        resolve: '@medusajs/medusa/event-bus-redis',
        options: { redisUrl },
      },
      {
        resolve: '@medusajs/medusa/workflow-engine-redis',
        options: { redis: { redisUrl } },
      },
      {
        resolve: '@medusajs/medusa/locking',
        options: {
          providers: [
            {
              resolve: '@medusajs/medusa/locking-redis',
              id: 'locking-redis',
              is_default: true,
              options: { redisUrl: lockingRedisUrl },
            },
          ],
        },
      },
    ]
  : []

const injectDashboardThemeBridge = (code: string, id: string) => {
  const normalizedId = id.replace(/\\/g, '/')
  const providerMarker = 'var Providers ='
  const i18nMarker = '/* @__PURE__ */ jsx3(I18n, {}),'

  if (
    !normalizedId.includes('/@medusajs/dashboard/dist/chunk-') ||
    !code.includes('var ThemeProvider') ||
    !code.includes(providerMarker) ||
    !code.includes(i18nMarker) ||
    code.includes('SynapseThemeBridge')
  ) {
    return null
  }

const bridge = `var SynapseThemeBridge = () => {
  const { theme, setTheme } = useTheme();
  useEffect2(() => {
    const toggleId = "synapse-admin-theme-toggle";
    let container = document.getElementById(toggleId);
    if (!container) {
      container = document.createElement("div");
      container.id = toggleId;
      document.body.appendChild(container);
    }
    let button = container.querySelector("button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      container.appendChild(button);
    }
    const currentTheme = theme === "system"
      ? document.documentElement.classList.contains("dark") ? "dark" : "light"
      : theme;
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    button.disabled = false;
    button.setAttribute("aria-label", "Switch to " + nextTheme + " mode");
    button.title = "Switch to " + nextTheme + " mode";
    button.innerHTML = currentTheme === "light"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42M7.06 16.94l-1.42 1.42"/><circle cx="12" cy="12" r="4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z"/></svg>';
    button.onclick = () => setTheme(nextTheme);

    const languageToggleId = "synapse-admin-language-toggle";
    let languageContainer = document.getElementById(languageToggleId);
    if (!languageContainer) {
      languageContainer = document.createElement("div");
      languageContainer.id = languageToggleId;
      document.body.appendChild(languageContainer);
    }
    let languageButton = languageContainer.querySelector("button");
    if (!languageButton) {
      languageButton = document.createElement("button");
      languageButton.type = "button";
      languageContainer.appendChild(languageButton);
    }
    const language = localStorage.getItem("lng") === "vi" ? "vi" : "en";
    const nextLanguage = language === "vi" ? "en" : "vi";
    languageButton.textContent = language === "vi" ? "VI" : "EN";
    languageButton.title = "Chuyển sang " + (nextLanguage === "vi" ? "Tiếng Việt" : "English");
    languageButton.setAttribute("aria-label", languageButton.title);
    languageButton.onclick = () => {
      localStorage.setItem("lng", nextLanguage);
      document.cookie = "lng=" + nextLanguage + "; path=/; max-age=31536000; SameSite=Lax";
      window.location.reload();
    };

    const mountInHeader = () => {
      const customizeButton = document.querySelector('button[aria-label="Customize layout"], button[aria-label="Tùy chỉnh bố cục"]');
      const headerActions = customizeButton?.parentElement;
      if (!headerActions || !customizeButton) {
        container.style.display = "none";
        languageContainer.style.display = "none";
        return;
      }
      if (languageContainer.parentElement !== headerActions) {
        headerActions.insertBefore(languageContainer, customizeButton);
      }
      if (container.parentElement !== headerActions) {
        headerActions.insertBefore(container, customizeButton);
      }
      container.style.display = "";
      languageContainer.style.display = "";
    };

    let mountFrame;
    const scheduleHeaderMount = () => {
      if (mountFrame) {
        return;
      }
      mountFrame = window.requestAnimationFrame(() => {
        mountFrame = undefined;
        mountInHeader();
      });
    };
    mountInHeader();
    const observer = new MutationObserver(scheduleHeaderMount);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (mountFrame) {
        window.cancelAnimationFrame(mountFrame);
      }
      button.onclick = null;
      languageButton.onclick = null;
    };
  }, [theme, setTheme]);
  return null;
};

`

  return code
    .replace(providerMarker, `${bridge}${providerMarker}`)
    .replace(
      i18nMarker,
      `/* @__PURE__ */ jsx3(SynapseThemeBridge, {}),\n        ${i18nMarker}`
    )
}

module.exports = defineConfig({
  admin: {
    vite: (config) => ({
      ...config,
      optimizeDeps: {
        ...config.optimizeDeps,
        esbuildOptions: {
          ...config.optimizeDeps?.esbuildOptions,
          plugins: [
            ...(config.optimizeDeps?.esbuildOptions?.plugins || []),
            {
              name: 'synapse-dashboard-theme-bridge',
              setup(build) {
                build.onLoad(
                  {
                    filter:
                      /@medusajs[\\/]dashboard[\\/]dist[\\/]chunk-.*\.mjs$/,
                  },
                  async (args) => {
                    const code = await readFile(args.path, 'utf8')
                    const transformed = injectDashboardThemeBridge(
                      code,
                      args.path
                    )

                    return transformed
                      ? { contents: transformed, loader: 'js' }
                      : null
                  }
                )
              },
            },
          ],
        },
      },
      plugins: [
        ...(config.plugins || []),
        {
          name: 'synapse-admin-title',
          transformIndexHtml(html: string) {
            return html.replace(/<title>.*?<\/title>/i, '<title>Synapse</title>')
          },
        },
        {
          name: 'synapse-admin-light-theme',
          transform(code: string, id: string) {
            if (!id.endsWith('/.medusa/client/entry.jsx')) {
              return null
            }

            const themePath = JSON.stringify(
              resolve(__dirname, 'src/admin/theme.css')
            )
            return `import ${themePath}\n\nif (!localStorage.getItem('medusa_admin_theme')) {\n  localStorage.setItem('medusa_admin_theme', 'light')\n}\n\n${code}`
          },
        },
        {
          name: 'synapse-dashboard-theme-bridge',
          enforce: 'pre',
          transform(code: string, id: string) {
            const transformed = injectDashboardThemeBridge(code, id)

            return transformed ? { code: transformed, map: null } : null
          },
        },
      ],
    }),
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
      authMethodsPerActor: {
        customer: [
          'emailpass',
          ...(isGoogleAuthConfigured ? ['google-one-tap'] : []),
        ],
        user: ['emailpass'],
      },
    }
  },
  modules: [
    ...productionInfrastructureModules,
    {
      resolve: '@medusajs/medusa/rbac',
    },
    {
      resolve: "./src/modules/agent-operations",
    },
    {
      resolve: '@medusajs/medusa/auth',
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/auth-emailpass',
            id: 'emailpass',
          },
          ...(isGoogleAuthConfigured
            ? [
                {
                  resolve: './src/modules/google-one-tap',
                  id: 'google-one-tap',
                  options: {
                    clientId: process.env.GOOGLE_CLIENT_ID,
                  },
                },
              ]
            : []),
        ],
      },
    },
  ],
})
