import { Check, Handshake } from 'lucide-react'
import type { CSSProperties } from 'react'
import { RobotGlyph } from './RobotGlyph'
import type { FrameStatus } from '../game/model'

export type WarehousePreviewType =
  | 'set-write'
  | 'for-each'
  | 'if-occupied'
  | 'swap'
  | 'advance-write'

export type WarehouseVisualMode = 'classic' | 'dual-robots'

export interface WarehousePreview {
  type: WarehousePreviewType
  runId: number
}

interface WarehouseBoardProps {
  values: number[]
  scanIndex: number | null
  writeIndex: number | null
  changedIndices: number[]
  status: FrameStatus
  message: string
  preview?: WarehousePreview | null
  visualMode?: WarehouseVisualMode
  activeAction?: WarehousePreviewType | null
  motionId?: number | string
}

const positionPercent = (index: number, length: number) =>
  ((index + 0.5) / length) * 100

const indexPosition = (index: number | null, length: number) => {
  if (index === null) return 8
  if (index >= length) return 100
  return positionPercent(Math.max(0, index), length)
}

const previewMessages: Record<WarehousePreviewType, string> = {
  'set-write': '技能预演：装载手来到目标货位上方。',
  'for-each': '技能预演：扫描手依次经过全部货位。',
  'if-occupied': '技能预演：扫描手检查当前货位是否有货。',
  swap: '技能预演：扫描手取箱投递，装载手接箱落位。',
  'advance-write': '技能预演：装载手向前移动一个货位。',
}

export function WarehouseBoard({
  values,
  scanIndex,
  writeIndex,
  changedIndices,
  status,
  message,
  preview = null,
  visualMode = 'classic',
  activeAction = null,
  motionId = 'idle',
}: WarehouseBoardProps) {
  const isDualRobot = visualMode === 'dual-robots'
  const previewType = preview?.type ?? null
  const actionType = previewType ?? activeAction
  const occupiedIndices = values.flatMap((value, index) => (value === 0 ? [] : [index]))
  const previewTargetIndex = Math.min(2, values.length - 1)
  const previewAdvanceStart = Math.min(1, values.length - 1)
  const previewAdvanceEnd = Math.min(previewAdvanceStart + 1, values.length - 1)

  let previewTransferSource = values.findIndex(
    (value, index) => value !== 0 && values.slice(0, index).some((candidate) => candidate === 0),
  )
  if (previewTransferSource < 0) previewTransferSource = occupiedIndices.at(-1) ?? 0
  let previewTransferTarget = values.findIndex(
    (value, index) => index < previewTransferSource && value === 0,
  )
  if (previewTransferTarget < 0) {
    previewTransferTarget = Math.max(0, previewTransferSource - 1)
  }

  const previewConditionIndex = occupiedIndices[0] ?? 0
  const effectiveScanIndex =
    previewType === 'swap'
      ? previewTransferSource
      : previewType === 'if-occupied'
        ? previewConditionIndex
        : previewType === 'for-each'
          ? 0
          : scanIndex
  const effectiveWriteIndex =
    previewType === 'swap'
      ? previewTransferTarget
      : previewType === 'set-write'
        ? previewTargetIndex
        : previewType === 'advance-write'
          ? previewAdvanceStart
          : writeIndex

  const scanPosition = indexPosition(effectiveScanIndex, values.length)
  const writePosition = indexPosition(effectiveWriteIndex, values.length)
  const classicWritePosition =
    writeIndex === null ? null : indexPosition(writeIndex, values.length)
  const isRuntimeAdvance =
    !previewType && activeAction === 'advance-write' && writeIndex !== null
  const isLoadMoving = previewType === 'advance-write' || isRuntimeAdvance
  const loadMoveStart =
    previewType === 'advance-write'
      ? indexPosition(previewAdvanceStart, values.length)
      : isRuntimeAdvance && writeIndex !== null
        ? indexPosition(Math.max(0, writeIndex - 1), values.length)
        : writePosition
  const loadMoveEnd =
    previewType === 'advance-write'
      ? indexPosition(previewAdvanceEnd, values.length)
      : writePosition

  const transferSourceIndex =
    actionType === 'swap'
      ? previewType === 'swap'
        ? previewTransferSource
        : scanIndex
      : null
  const transferTargetIndex =
    actionType === 'swap'
      ? previewType === 'swap'
        ? previewTransferTarget
        : writeIndex
      : null
  const isSamePosition =
    isDualRobot &&
    actionType === 'swap' &&
    transferSourceIndex !== null &&
    transferTargetIndex !== null &&
    transferSourceIndex === transferTargetIndex
  const isTransfer =
    isDualRobot &&
    actionType === 'swap' &&
    transferSourceIndex !== null &&
    transferTargetIndex !== null &&
    transferSourceIndex !== transferTargetIndex
  const transferredValue =
    isTransfer && transferSourceIndex !== null && transferTargetIndex !== null
      ? previewType === 'swap'
        ? values[transferSourceIndex]
        : values[transferTargetIndex]
      : 0

  const motionStyle = (start: number, end: number) =>
    ({
      '--motion-start': String(start) + '%',
      '--motion-end': String(end) + '%',
      left: String(end) + '%',
    }) as CSSProperties

  const loadRobotStyle = isLoadMoving
    ? motionStyle(loadMoveStart, loadMoveEnd)
    : ({ left: String(writePosition) + '%' } as CSSProperties)
  const scanRobotStyle =
    previewType === 'for-each'
      ? motionStyle(indexPosition(0, values.length), indexPosition(values.length - 1, values.length))
      : ({ left: String(scanPosition) + '%' } as CSSProperties)
  const transferStyle =
    isTransfer && transferSourceIndex !== null && transferTargetIndex !== null
      ? motionStyle(
          indexPosition(transferSourceIndex, values.length),
          indexPosition(transferTargetIndex, values.length),
        )
      : undefined

  const boardClassName = [
    'warehouse-board',
    isDualRobot ? 'is-dual-robot' : 'is-classic-robot',
    previewType ? 'is-skill-preview' : '',
    previewType ? 'preview-' + previewType : '',
    isSamePosition ? 'is-same-position-action' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={boardClassName}>
      <div className="warehouse-grid" aria-hidden="true" />

      {isDualRobot ? (
        <>
          <div className="dual-load-track">
            <div
              key={
                isLoadMoving
                  ? 'load-motion-' + String(preview?.runId ?? motionId)
                  : 'load-runtime'
              }
              className={[
                'load-robot',
                effectiveWriteIndex === null ? 'is-idle' : '',
                effectiveWriteIndex !== null && effectiveWriteIndex >= values.length
                  ? 'is-at-end'
                  : '',
                previewType === 'set-write' ? 'is-setting' : '',
                isLoadMoving ? 'is-advancing' : '',
                isTransfer ? 'is-catching' : '',
                isSamePosition ? 'is-cooperating' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={loadRobotStyle}
            >
              <span className="dual-robot-tag load-tag">装载手</span>
              <RobotGlyph variant="load" />
              <span className="load-catch-tray" aria-hidden="true" />
            </div>
          </div>

          <div className="dual-scan-track">
            <div
              key={
                previewType === 'for-each'
                  ? 'scan-preview-' + String(preview?.runId)
                  : 'scan-runtime'
              }
              className={[
                'fast-scan-robot',
                effectiveScanIndex === null ? 'is-idle' : '',
                previewType === 'for-each' ? 'is-preview-scanning' : '',
                previewType === 'if-occupied' ? 'is-checking' : '',
                isTransfer ? 'is-throwing' : '',
                isSamePosition ? 'is-cooperating' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={scanRobotStyle}
            >
              <span className="dual-robot-tag scan-tag">扫描手</span>
              <RobotGlyph variant="scan" />
              <span className="fast-pickup-claw" aria-hidden="true" />
            </div>
          </div>
        </>
      ) : (
        <div className="scan-track" aria-hidden="true">
          <div
            className={[
              'scan-robot',
              scanIndex === null ? 'is-idle' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: String(indexPosition(scanIndex, values.length)) + '%' }}
          >
            <span className="robot-tag">扫描臂</span>
            <RobotGlyph />
            <span className="scan-beam" />
          </div>
        </div>
      )}

      <div className="cargo-zone">
        <div className="cargo-slots" style={{ gridTemplateColumns: 'repeat(' + values.length + ', 1fr)' }}>
          {values.map((value, index) => {
            const isScanning = scanIndex === index
            const isWriting = writeIndex === index
            const isChanged = changedIndices.includes(index)
            const isPreviewCondition =
              previewType === 'if-occupied' && index === previewConditionIndex
            const isPreviewSetTarget =
              previewType === 'set-write' && index === previewTargetIndex
            const isTransferSource = isTransfer && index === transferSourceIndex
            const isTransferTarget = isTransfer && index === transferTargetIndex
            const slotClassName = [
              'cargo-slot',
              isScanning ? 'is-scanning' : '',
              isWriting ? 'is-writing' : '',
              isChanged ? 'is-changed' : '',
              isPreviewCondition ? 'is-preview-condition' : '',
              isPreviewSetTarget ? 'is-preview-set-target' : '',
              isTransferSource ? 'is-transfer-source' : '',
              isTransferTarget ? 'is-transfer-target' : '',
            ]
              .filter(Boolean)
              .join(' ')
            const writingLabel = isWriting
              ? isDualRobot
                ? '，装载机器人驻守此处'
                : '，装载标记位于此处'
              : ''
            const scanningLabel = isScanning ? '，扫描机器人正在检查此处' : ''

            return (
              <div
                key={index}
                className={slotClassName}
                aria-label={
                  String(index) +
                  ' 号货位，' +
                  (value === 0 ? '空位' : '货箱 ' + String(value)) +
                  writingLabel +
                  scanningLabel
                }
              >
                <span className="cargo-index">{index}</span>
                {value === 0 ? (
                  <span className="empty-mark cargo-empty">0</span>
                ) : (
                  <span className="crate cargo-crate"><span>{value}</span></span>
                )}
                {isPreviewCondition && (
                  <span
                    key={'preview-condition-' + String(preview?.runId)}
                    className="preview-condition-badge"
                    aria-hidden="true"
                  >
                    <Check size={17} strokeWidth={3} />
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {!isDualRobot && classicWritePosition !== null && (
          <div
            className="write-beacon"
            style={{ left: String(classicWritePosition) + '%' }}
            aria-hidden="true"
          >
            <span>装载位</span>
            <span className="beacon-arrow" />
          </div>
        )}

        {isTransfer && transferStyle && (
          <span
            key={'transfer-' + String(preview?.runId ?? motionId)}
            className={[
              'dual-transfer-cargo',
              previewType ? 'is-preview-transfer' : 'is-runtime-transfer',
            ]
              .filter(Boolean)
              .join(' ')}
            style={transferStyle}
            aria-hidden="true"
          >
            <span>{transferredValue}</span>
          </span>
        )}

        {isSamePosition && transferTargetIndex !== null && (
          <span
            key={'same-position-' + String(preview?.runId ?? motionId)}
            className="dual-same-position-badge"
            style={{ left: String(indexPosition(transferTargetIndex, values.length)) + '%' }}
            role="status"
            aria-label="扫描机器人和装载机器人位于同一货位，货箱保持原位"
          >
            <Handshake size={16} />
            <span>同位协作</span>
          </span>
        )}

        <div className="dock-line" aria-hidden="true" />
      </div>

      <div
        className={[
          'runtime-message',
          'status-' + (previewType ? 'running' : status),
          previewType ? 'is-preview-message' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-live="polite"
      >
        <span className="status-light" />
        <span>{previewType ? previewMessages[previewType] : message}</span>
      </div>
    </div>
  )
}
