const fs = require("node:fs")
const path = require("node:path")
const c = require("ansi-colors")

const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    // TODO: we need a good doc to point this to
    description:
      "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys",
  },
  {
    key: "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
    description:
      "Set this to the Medusa API origin used by this storefront, for example http://127.0.0.1:9000 during local development.",
  },
]

function getDuplicateEnvKeys(filePath, keys) {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const seen = new Map()

  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=/)
      if (!match || !keys.includes(match[1])) {
        return
      }

      const lines = seen.get(match[1]) || []
      lines.push(index + 1)
      seen.set(match[1], lines)
    })

  return [...seen.entries()].filter(([, lines]) => lines.length > 1)
}

function validateBackendUrl() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function checkEnvVariables() {
  const missingEnvs = requiredEnvs.filter(function (env) {
    c
    return !process.env[env.key]
  })

  const envFile = path.join(process.cwd(), ".env.local")
  const duplicateEntries = getDuplicateEnvKeys(envFile, [
    "NEXT_PUBLIC_MEDUSA_BACKEND_URL",
  ])

  if (
    missingEnvs.length > 0 ||
    !validateBackendUrl() ||
    duplicateEntries.length > 0
  ) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n"),
    )

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`))
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`))
      }
    })

    if (!validateBackendUrl()) {
      console.error(c.yellow(`  ${c.bold("NEXT_PUBLIC_MEDUSA_BACKEND_URL")}`))
      console.error(c.dim("    It must be a valid http:// or https:// URL.\n"))
    }

    duplicateEntries.forEach(([key, lines]) => {
      console.error(
        c.yellow(
          `  ${c.bold(key)} is declared more than once in .env.local (lines ${lines.join(", ")}).`,
        ),
      )
      console.error(
        c.dim(
          "    Keep exactly one value. Next.js otherwise resolves this silently and can call the wrong backend.\n",
        ),
      )
    })

    console.error(
      c.yellow(
        "\nPlease set these variables in your .env file or environment before starting the application.\n",
      ),
    )

    process.exit(1)
  }
}

module.exports = checkEnvVariables
