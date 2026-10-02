package model

kind: "Mapgl"
spec: close({
  nodeIdField: string & =~"\\S"
  targetField: string & =~"\\S"
  labelField?: string
})
