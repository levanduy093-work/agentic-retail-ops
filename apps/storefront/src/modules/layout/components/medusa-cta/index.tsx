import { Text } from "@modules/common/components/ui"

const MedusaCTA = ({ label }: { label: string }) => {
  return (
    <Text className="flex gap-x-2 txt-compact-small-plus items-center">
      {label}
    </Text>
  )
}

export default MedusaCTA
