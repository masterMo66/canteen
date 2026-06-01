import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, WheelEvent } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  FileSpreadsheet,
  MapPin,
  Moon,
  ShoppingBag,
  Soup,
  Star,
  Sunrise,
  Utensils,
} from 'lucide-react'
import canteenSpread from './assets/canteen-spread.png'
import { menuDays, menuRange, type Meal, type MenuDay } from './menuData'
import './App.css'

type TabKey = 'today' | 'calendar'
type FloorId = '1f' | '2f' | '3f'
type MealType = 'breakfast' | 'lunch' | 'dinner'

type FloorMenu = {
  id: FloorId
  number: string
  label: string
  shortLabel: string
  restaurantName: string
  location: string
  source: string
  meals: Meal[]
}

const floorLabels = [
  { id: '1f' as const, number: '1', label: '1楼', shortLabel: '1F' },
  { id: '2f' as const, number: '2', label: '2楼', shortLabel: '2F' },
  { id: '3f' as const, number: '3', label: '3楼', shortLabel: '3F' },
]

const mealTypeOptions = [
  { type: 'breakfast' as const, label: '早餐', icon: Sunrise },
  { type: 'lunch' as const, label: '午餐', icon: Utensils },
  { type: 'dinner' as const, label: '晚餐', icon: Moon },
]

const mealTypeLabels: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
}

function getShanghaiDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  const hour = parts.find((part) => part.type === 'hour')?.value
  const minute = parts.find((part) => part.type === 'minute')?.value

  return {
    dateKey: `${year}-${month}-${day}`,
    hour: Number(hour),
    minute: Number(minute),
  }
}

function dateKeyToUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey)
  date.setUTCDate(date.getUTCDate() + days)

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getAutoMealState(now = new Date()) {
  const { dateKey, hour, minute } = getShanghaiDateParts(now)
  const minutes = hour * 60 + minute

  if (minutes < 8 * 60 + 40) return { activeDate: dateKey, mealType: 'breakfast' as const }
  if (minutes < 12 * 60 + 30) return { activeDate: dateKey, mealType: 'lunch' as const }
  if (minutes < 18 * 60 + 30) return { activeDate: dateKey, mealType: 'dinner' as const }

  return { activeDate: addDaysToDateKey(dateKey, 1), mealType: 'breakfast' as const }
}

function getRequestedDateKey() {
  if (typeof window === 'undefined') {
    return null
  }

  return new URLSearchParams(window.location.search).get('date')
}

function getInitialTodayState() {
  const autoState = getAutoMealState()
  const requestedDate = getRequestedDateKey()

  return {
    ...autoState,
    activeDate: requestedDate ?? autoState.activeDate,
    hasDateOverride: Boolean(requestedDate),
  }
}

function isThirdFloorMeal(meal: Meal) {
  return meal.name.includes('三楼') || meal.time.includes('三楼')
}

function findRestaurant(day: MenuDay, id: string) {
  return day.restaurants.find((restaurant) => restaurant.id === id)
}

function buildFloors(day: MenuDay): FloorMenu[] {
  const firstFloor = findRestaurant(day, 'huangshan-1f')
  const shuwang = findRestaurant(day, 'shuwang')
  const secondFloorMeals = shuwang?.meals.filter((meal) => !isThirdFloorMeal(meal)) ?? []
  const thirdFloorMeals = shuwang?.meals.filter(isThirdFloorMeal) ?? []

  return [
    {
      ...floorLabels[0],
      restaurantName: firstFloor?.name ?? '黄山大厦 总行餐厅 1楼',
      location: firstFloor?.location ?? '总行餐厅一楼',
      source: firstFloor?.source ?? '黄山大厦 总行餐厅 1楼周菜单',
      meals: firstFloor?.meals ?? [],
    },
    {
      ...floorLabels[1],
      restaurantName: '蜀王餐厅 2楼',
      location: '二楼餐区',
      source: shuwang?.source ?? '蜀王餐厅一周菜单6.1-6.5.xlsx',
      meals: secondFloorMeals,
    },
    {
      ...floorLabels[2],
      restaurantName: '三楼餐区',
      location: '蜀王餐厅三楼',
      source: shuwang?.source ?? '蜀王餐厅一周菜单6.1-6.5.xlsx',
      meals: thirdFloorMeals,
    },
  ]
}

function getClosestMenuDay(dateKey: string) {
  const targetTime = dateKeyToUtcDate(dateKey).getTime()

  return menuDays.reduce((closest, day) => {
    const closestDistance = Math.abs(dateKeyToUtcDate(closest.date).getTime() - targetTime)
    const nextDistance = Math.abs(dateKeyToUtcDate(day.date).getTime() - targetTime)

    return nextDistance < closestDistance ? day : closest
  }, menuDays[0])
}

function getVisibleDay(activeDate: string) {
  const day = menuDays.find((menuDay) => menuDay.date === activeDate)

  return {
    day: day ?? getClosestMenuDay(activeDate),
    isFallback: !day,
    requestedDate: activeDate,
  }
}

function countDishes(meal: Meal) {
  return meal.sections.reduce((sum, section) => sum + section.items.length, 0)
}

function countMealsDishes(meals: Meal[]) {
  return meals.reduce((sum, meal) => sum + countDishes(meal), 0)
}

function getMealType(meal: Meal): MealType | null {
  if (meal.name.includes('早餐') || meal.time.includes('早餐')) return 'breakfast'
  if (meal.name.includes('午餐') || meal.name.includes('中餐') || meal.time.includes('午餐') || meal.time.includes('中餐')) {
    return 'lunch'
  }
  if (meal.name.includes('晚餐') || meal.time.includes('晚餐')) return 'dinner'
  if (isThirdFloorMeal(meal)) return 'lunch'

  return null
}

function getMealsByType(meals: Meal[], mealType?: MealType) {
  if (!mealType) return meals

  return meals.filter((meal) => getMealType(meal) === mealType)
}

function renderMealIcon(name: string) {
  const iconProps = { size: 20, strokeWidth: 1.8, 'aria-hidden': 'true' as const }

  if (name.includes('早餐')) return <Sunrise {...iconProps} />
  if (name.includes('午餐')) return <Utensils {...iconProps} />
  if (name.includes('晚餐')) return <Moon {...iconProps} />
  if (name.includes('外卖')) return <ShoppingBag {...iconProps} />
  if (name.includes('三楼')) return <Soup {...iconProps} />
  return <Coffee {...iconProps} />
}

function formatDateLine(day: MenuDay) {
  return `2026.${day.label.replace('月', '.').replace('日', '')} ${day.weekday}`
}

function compactDate(dateKey: string) {
  const [, month, day] = dateKey.split('-')
  return `${Number(month)}.${Number(day)}`
}

function formatMenuRangeLabel() {
  const [start, end] = menuRange.split(' 至 ')
  return `${compactDate(start)}-${compactDate(end)}`
}

function clampFloor(index: number) {
  return Math.max(0, Math.min(floorLabels.length - 1, index))
}

function formatDateKeyLine(dateKey: string, knownDay?: MenuDay) {
  if (knownDay?.date === dateKey) return formatDateLine(knownDay)

  const date = dateKeyToUtcDate(dateKey)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  const weekday = parts.find((part) => part.type === 'weekday')?.value

  return `${year}.${month}.${day} ${weekday}`
}

function formatDateKeyShort(dateKey: string) {
  const [, month, day] = dateKey.split('-')
  return `${Number(month)}月${Number(day)}日`
}

function ArchiveNav({
  activeTab,
  onTabChange,
  activeDay,
  activeDate,
}: {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  activeDay: MenuDay
  activeDate: string
}) {
  return (
    <nav className="archive-nav" aria-label="食堂页面">
      <div className="archive-brand" aria-label="食堂档案">
        <span>食堂档案</span>
        <small>CANTEEN ARCHIVE</small>
      </div>

      <div className="nav-tabs" role="tablist" aria-label="菜单视图">
        <button
          aria-selected={activeTab === 'today'}
          className={activeTab === 'today' ? 'nav-tab nav-tab-active' : 'nav-tab'}
          onClick={() => onTabChange('today')}
          role="tab"
          type="button"
        >
          今日食堂
        </button>
        <button
          aria-selected={activeTab === 'calendar'}
          className={activeTab === 'calendar' ? 'nav-tab nav-tab-active' : 'nav-tab'}
          onClick={() => onTabChange('calendar')}
          role="tab"
          type="button"
        >
          食堂日历
        </button>
      </div>

      <div className="nav-date">
        <CalendarDays size={17} strokeWidth={1.8} aria-hidden="true" />
        <span>{activeTab === 'today' ? formatDateKeyLine(activeDate, activeDay) : `菜单周期 ${formatMenuRangeLabel()}`}</span>
      </div>
    </nav>
  )
}

function MealTypeSelector({
  mealType,
  onMealTypeChange,
}: {
  mealType: MealType
  onMealTypeChange: (mealType: MealType) => void
}) {
  return (
    <div className="meal-type-selector" role="radiogroup" aria-label="选择用餐时段">
      {mealTypeOptions.map(({ type, label, icon: Icon }) => (
        <button
          aria-checked={mealType === type}
          className={mealType === type ? 'meal-type-option meal-type-option-active' : 'meal-type-option'}
          key={type}
          onClick={() => onMealTypeChange(type)}
          role="radio"
          type="button"
        >
          <Icon size={15} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

function FloorProgress({
  floors,
  activeFloor,
  onFloorChange,
}: {
  floors: FloorMenu[]
  activeFloor: number
  onFloorChange: (index: number) => void
}) {
  return (
    <div className="floor-progress" aria-label="楼层进度">
      {floors.map((floor, index) => (
        <button
          aria-label={`切换到${floor.label}`}
          aria-pressed={activeFloor === index}
          className={activeFloor === index ? 'floor-progress-step floor-progress-step-active' : 'floor-progress-step'}
          key={floor.id}
          onClick={() => onFloorChange(index)}
          type="button"
        >
          <span className="floor-progress-dot" />
          <span className="floor-progress-label">{floor.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}

function MealArchive({ meal, mealType }: { meal: Meal; mealType?: MealType }) {
  const mealTitle = mealType ? mealTypeLabels[mealType] : meal.name

  return (
    <article className="meal-archive">
      <header className="meal-archive-header">
        <div className="meal-archive-title">
          {renderMealIcon(mealTitle)}
          <span>{mealTitle}</span>
        </div>
      </header>

      <div className="menu-lines">
        {meal.sections.map((section) => (
          <div className={section.title.includes('新菜') ? 'menu-line menu-line-new' : 'menu-line'} key={section.title}>
            <span className="menu-line-title">{section.title}</span>
            <span className="menu-line-items">{section.items.join('、')}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function FloorTicket({
  floor,
  active,
  mealType,
  cardRef,
  onSelect,
}: {
  floor: FloorMenu
  active: boolean
  mealType?: MealType
  cardRef?: (node: HTMLElement | null) => void
  onSelect?: () => void
}) {
  const selectable = Boolean(onSelect && !active)
  const visibleMeals = getMealsByType(floor.meals, mealType)
  const emptyText = mealType ? `本楼层暂无${mealTypeLabels[mealType]}菜单` : '本日暂无该楼层菜单。'

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!selectable || (event.key !== 'Enter' && event.key !== ' ')) return

    event.preventDefault()
    onSelect?.()
  }

  return (
    <article
      aria-label={selectable ? `切换到${floor.label}` : undefined}
      className={[
        'floor-ticket',
        active ? 'floor-ticket-active' : '',
        selectable ? 'floor-ticket-selectable' : '',
      ].filter(Boolean).join(' ')}
      onClick={selectable ? onSelect : undefined}
      onKeyDown={handleKeyDown}
      ref={cardRef}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
    >
      <div className="ticket-corners" aria-hidden="true" />
      <header className="floor-ticket-header">
        <div>
          <div className="floor-kicker">
            <span className="floor-number">{floor.number}</span>
            <span>{floor.label}</span>
          </div>
          <h2>{floor.restaurantName}</h2>
        </div>
        {active && (
          <span className="active-stamp">
            <Star size={13} fill="currentColor" strokeWidth={1.4} aria-hidden="true" />
            当前楼层
          </span>
        )}
      </header>

      <div className="ticket-meta">
        <span>
          <MapPin size={14} strokeWidth={1.7} aria-hidden="true" />
          {floor.location}
        </span>
        <span>
          <FileSpreadsheet size={14} strokeWidth={1.7} aria-hidden="true" />
          {floor.source}
        </span>
      </div>

      <div className="ticket-divider" aria-hidden="true" />

      <div className="ticket-meals">
        {visibleMeals.length > 0 ? (
          visibleMeals.map((meal) => (
            <MealArchive meal={meal} mealType={mealType} key={`${floor.id}-${mealType ?? 'all'}-${meal.name}`} />
          ))
        ) : (
          <p className="empty-floor">{emptyText}</p>
        )}
      </div>

      <footer className="ticket-footnote">
        <span>{countMealsDishes(visibleMeals)} 道餐品</span>
        <span>以餐厅实际供应为准</span>
      </footer>
    </article>
  )
}

function FloorShowcase({
  day,
  activeFloor,
  onFloorChange,
  mealType,
}: {
  day: MenuDay
  activeFloor: number
  onFloorChange: (index: number) => void
  mealType?: MealType
}) {
  const floors = useMemo(() => buildFloors(day), [day])
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const measuredCardRef = useRef<HTMLElement | null>(null)
  const dragStartX = useRef<number | null>(null)
  const suppressCardClick = useRef(false)
  const wheelLocked = useRef(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [railMetrics, setRailMetrics] = useState({
    cardStep: 0,
    cardWidth: 0,
    carouselWidth: 0,
  })

  useEffect(() => {
    const measure = () => {
      const carousel = carouselRef.current
      const rail = railRef.current
      const card = measuredCardRef.current

      if (!carousel || !rail || !card) return

      const secondCard = rail.children[1] as HTMLElement | undefined
      const gap = Number.parseFloat(window.getComputedStyle(rail).columnGap || '0')

      setIsDesktop(window.matchMedia('(min-width: 761px)').matches)
      setRailMetrics({
        cardStep: secondCard ? secondCard.offsetLeft - card.offsetLeft : card.offsetWidth + gap,
        cardWidth: card.offsetWidth,
        carouselWidth: carousel.clientWidth,
      })
    }

    measure()

    if (!measuredCardRef.current || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const observer = new ResizeObserver(measure)
    if (carouselRef.current) observer.observe(carouselRef.current)
    observer.observe(measuredCardRef.current)
    return () => observer.disconnect()
  }, [day])

  const switchFloor = (index: number) => {
    onFloorChange(clampFloor(index))
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStartX.current = event.clientX
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current === null) return

    const distance = event.clientX - dragStartX.current
    dragStartX.current = null

    if (Math.abs(distance) < 46) return
    suppressCardClick.current = true
    switchFloor(activeFloor + (distance < 0 ? 1 : -1))
    window.setTimeout(() => {
      suppressCardClick.current = false
    }, 0)
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : 0

    if (Math.abs(delta) < 28 || wheelLocked.current) return

    event.preventDefault()
    wheelLocked.current = true
    switchFloor(activeFloor + (delta > 0 ? 1 : -1))
    window.setTimeout(() => {
      wheelLocked.current = false
    }, 430)
  }

  const centeredOffset = isDesktop ? (railMetrics.carouselWidth - railMetrics.cardWidth) / 2 : 0

  const railStyle = {
    transform: `translate3d(${centeredOffset - activeFloor * railMetrics.cardStep}px, 0, 0)`,
  } satisfies CSSProperties

  return (
    <section className="floor-showcase" aria-label={`${day.weekday}${day.label}楼层菜单`}>
      <div
        className="floor-carousel"
        ref={carouselRef}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => {
          dragStartX.current = null
        }}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="floor-rail" ref={railRef} style={railStyle}>
          {floors.map((floor, index) => (
            <FloorTicket
              active={activeFloor === index}
              cardRef={index === 0 ? (node) => {
                measuredCardRef.current = node
              } : undefined}
              floor={floor}
              key={floor.id}
              mealType={mealType}
              onSelect={isDesktop && activeFloor !== index ? () => {
                if (suppressCardClick.current) return
                switchFloor(index)
              } : undefined}
            />
          ))}
        </div>
      </div>

      <div className="showcase-controls" aria-label="楼层切换">
        <button aria-label="上一楼层" onClick={() => switchFloor(activeFloor - 1)} type="button">
          <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="floor-dots" aria-hidden="true">
          {floors.map((floor, index) => (
            <span className={activeFloor === index ? 'floor-dot floor-dot-active' : 'floor-dot'} key={floor.id} />
          ))}
        </div>
        <button aria-label="下一楼层" onClick={() => switchFloor(activeFloor + 1)} type="button">
          <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <FloorProgress floors={floors} activeFloor={activeFloor} onFloorChange={switchFloor} />
    </section>
  )
}

function TodayView({
  day,
  activeDate,
  mealType,
  onMealTypeChange,
  isFallback,
  requestedDate,
}: {
  day: MenuDay
  activeDate: string
  mealType: MealType
  onMealTypeChange: (mealType: MealType) => void
  isFallback: boolean
  requestedDate: string
}) {
  const [activeFloor, setActiveFloor] = useState(0)

  return (
    <section className="screen-grid today-screen" role="tabpanel">
      <div className="screen-copy">
        <h1>今日食堂</h1>
        <div className="today-meta-panel">
          <p className="screen-date">
            <CalendarDays size={20} strokeWidth={1.8} aria-hidden="true" />
            {formatDateKeyLine(activeDate, day)}
          </p>
          <p className="screen-range">菜单周期：{formatMenuRangeLabel()}</p>
          <MealTypeSelector mealType={mealType} onMealTypeChange={onMealTypeChange} />
          {isFallback && (
            <p className="coverage-note">
              暂无 {formatDateKeyShort(requestedDate)}{mealTypeLabels[mealType]}菜单，暂显示 {day.label} 的餐谱。
            </p>
          )}
        </div>
        <div className="swipe-hint">
          <span aria-hidden="true">↔</span>
          左右滑动切换楼层
        </div>
      </div>

      <FloorShowcase activeFloor={activeFloor} day={day} mealType={mealType} onFloorChange={setActiveFloor} />
    </section>
  )
}

function DayTicket({
  day,
  active,
  onSelect,
}: {
  day: MenuDay
  active: boolean
  onSelect: () => void
}) {
  const floors = useMemo(() => buildFloors(day), [day])

  return (
    <button className={active ? 'day-ticket day-ticket-active' : 'day-ticket'} onClick={onSelect} type="button">
      <span className="day-ticket-weekday">{day.shortWeekday}</span>
      <strong>{day.label.replace('月', '.').replace('日', '')}</strong>
      <span className="day-ticket-line" />
      {floors.map((floor) => (
        <span className="day-ticket-floor" key={floor.id}>
          <b>{floor.label}</b>
          <span>{floor.restaurantName}</span>
        </span>
      ))}
    </button>
  )
}

function CalendarView({ initialDay }: { initialDay: MenuDay }) {
  const [selectedDate, setSelectedDate] = useState(initialDay.date)
  const [activeFloor, setActiveFloor] = useState(1)
  const selectedDay = menuDays.find((day) => day.date === selectedDate) ?? menuDays[0]

  return (
    <section className="screen-grid calendar-screen" role="tabpanel">
      <div className="screen-copy calendar-copy">
        <h1>食堂日历</h1>
        <p className="screen-date">
          <Clock3 size={20} strokeWidth={1.8} aria-hidden="true" />
          完整周一到周五菜单
        </p>
        <p className="screen-range">选择日期后，继续滑动查看 1楼、2楼、3楼完整菜单。</p>

        <div className="week-strip" aria-label="周一到周五菜单">
          {menuDays.map((day) => (
            <DayTicket
              active={day.date === selectedDay.date}
              day={day}
              key={day.date}
              onSelect={() => {
                setSelectedDate(day.date)
                setActiveFloor(1)
              }}
            />
          ))}
        </div>
      </div>

      <div className="calendar-detail">
        <div className="calendar-detail-heading">
          <span>{selectedDay.shortWeekday}</span>
          <strong>{selectedDay.label}</strong>
        </div>
        <FloorShowcase activeFloor={activeFloor} day={selectedDay} onFloorChange={setActiveFloor} />
      </div>
    </section>
  )
}

function App() {
  const initialTodayState = useMemo(() => getInitialTodayState(), [])
  const [activeDate, setActiveDate] = useState(initialTodayState.activeDate)
  const [mealType, setMealType] = useState<MealType>(initialTodayState.mealType)
  const manualMealSelection = useRef(false)
  const { day, isFallback, requestedDate } = useMemo(() => getVisibleDay(activeDate), [activeDate])
  const [activeTab, setActiveTab] = useState<TabKey>('today')

  useEffect(() => {
    if (initialTodayState.hasDateOverride) return undefined

    const intervalId = window.setInterval(() => {
      const nextAutoState = getAutoMealState()

      setActiveDate((currentActiveDate) => {
        if (currentActiveDate !== nextAutoState.activeDate) {
          manualMealSelection.current = false
          setMealType(nextAutoState.mealType)
          return nextAutoState.activeDate
        }

        if (!manualMealSelection.current) {
          setMealType(nextAutoState.mealType)
        }

        return currentActiveDate
      })
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [initialTodayState.hasDateOverride])

  const handleMealTypeChange = (nextMealType: MealType) => {
    manualMealSelection.current = true
    setMealType(nextMealType)
  }

  return (
    <main className="app-shell">
      <img className="ambient-food" src={canteenSpread} alt="" aria-hidden="true" />
      <ArchiveNav activeDate={activeDate} activeDay={day} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'today' ? (
        <TodayView
          activeDate={activeDate}
          day={day}
          isFallback={isFallback}
          mealType={mealType}
          onMealTypeChange={handleMealTypeChange}
          requestedDate={requestedDate}
        />
      ) : (
        <CalendarView initialDay={day} />
      )}

      <footer className="page-footer">
        <span>
          <FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden="true" />
          黄山大厦 1楼菜单 / 蜀王餐厅 2楼、3楼、外卖菜单
        </span>
        <span>菜品可能随当日供应调整，以餐厅实际出品为准。</span>
      </footer>
    </main>
  )
}

export default App
