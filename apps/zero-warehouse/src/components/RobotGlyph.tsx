interface RobotGlyphProps {
  className?: string
  variant?: 'scan' | 'load'
}

export function RobotGlyph({ className, variant = 'scan' }: RobotGlyphProps) {
  const isLoadRobot = variant === 'load'

  return (
    <svg
      className={className}
      viewBox="0 0 96 74"
      role="img"
      aria-label={isLoadRobot ? '仓库装载机器人' : '仓库扫描机器人'}
    >
      <path d="M10 12H86" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <circle cx="27" cy="12" r="6" fill="#f2c94c" stroke="#17201b" strokeWidth="3" />
      <circle cx="69" cy="12" r="6" fill="#f2c94c" stroke="#17201b" strokeWidth="3" />
      <path d="M48 15V28" stroke="#17201b" strokeWidth="5" />
      <rect x="25" y="27" width="46" height="32" rx="7" fill="#f8faf9" stroke="#17201b" strokeWidth="4" />
      <rect x="32" y="34" width="32" height="13" rx="4" fill={isLoadRobot ? '#f2c94c' : '#0c8f7d'} />
      <circle cx="41" cy="40.5" r="3" fill="#f8faf9" />
      <circle cx="55" cy="40.5" r="3" fill="#f8faf9" />
      <path d="M38 53H58" stroke="#17201b" strokeWidth="3" strokeLinecap="round" />
      {isLoadRobot ? (
        <>
          <path d="M28 59L18 68M68 59L78 68" stroke="#17201b" strokeWidth="5" strokeLinecap="round" />
          <path d="M13 69H30M66 69H83" stroke="#17201b" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <path d="M34 60V69M62 60V69" stroke="#17201b" strokeWidth="5" strokeLinecap="round" />
      )}
    </svg>
  )
}
