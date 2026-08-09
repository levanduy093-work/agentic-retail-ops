import { Text } from "@modules/common/components/ui"

import Medusa from "../../../common/icons/medusa"
import NextJs from "../../../common/icons/nextjs"

const MedusaCTA = ({ label }: { label: string }) => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      {label}
    </Text>
  )
}

export default MedusaCTA
