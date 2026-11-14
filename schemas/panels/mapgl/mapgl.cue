package model

kind: "Mapgl"
spec: close({
  nodeIdField: string & =~"\\S"
  targetField: string & =~"\\S"
  labelField?: string
  edgeLabelField?: string
  sideALabelField?: string
  sideBLabelField?: string
  edgeRouting?: "Splines" | "Rectilinear"
  nodeCards?: bool
  arrow?: 0 | 1 | -1 | 2
  edgeLabels?: bool
})
