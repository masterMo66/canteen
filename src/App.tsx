import {
  Building2,
  CalendarDays,
  Clock3,
  Coffee,
  FileSpreadsheet,
  MapPin,
  Moon,
  ShoppingBag,
  Soup,
  Sunrise,
  Utensils,
} from 'lucide-react'
import canteenSpread from './assets/canteen-spread.png'
import { menuDays, menuRange, type Meal, type MenuDay, type RestaurantMenu } from './menuData'
import './App.css'

function getShanghaiDateKey() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function getRequestedDateKey() {
  if (typeof window === 'undefined') {
    return getShanghaiDateKey()
  }

  return new URLSearchParams(window.location.search).get('date') ?? getShanghaiDateKey()
}

function getVisibleDay() {
  const requestedDate = getRequestedDateKey()
  const day = menuDays.find((menuDay) => menuDay.date === requestedDate)

  return {
    day: day ?? menuDays[0],
    isFallback: !day,
    requestedDate,
  }
}

function countDishes(meal: Meal) {
  return meal.sections.reduce((sum, section) => sum + section.items.length, 0)
}

function renderMealIcon(name: string) {
  const iconProps = { size: 18, strokeWidth: 1.8, 'aria-hidden': 'true' as const }

  if (name.includes('早餐')) return <Sunrise {...iconProps} />
  if (name.includes('午餐')) return <Utensils {...iconProps} />
  if (name.includes('晚餐')) return <Moon {...iconProps} />
  if (name.includes('外卖')) return <ShoppingBag {...iconProps} />
  if (name.includes('三楼')) return <Soup {...iconProps} />
  return <Coffee {...iconProps} />
}

function formatDateLine(day: MenuDay) {
  return `2026年${day.label} ${day.weekday}`
}

function MealPanel({ meal }: { meal: Meal }) {
  return (
    <article className="meal-panel">
      <header className="meal-header">
        <div>
          <span className="meal-name">
            {renderMealIcon(meal.name)}
            {meal.name}
          </span>
          <span className="meal-time">{meal.time}</span>
        </div>
        <span className="dish-count">{countDishes(meal)} 道</span>
      </header>

      <div className="section-list">
        {meal.sections.map((section) => (
          <div
            className={section.title.includes('新菜') ? 'section-row section-row-new' : 'section-row'}
            key={section.title}
          >
            <div className="section-title">{section.title}</div>
            <div className="dish-list">
              {section.items.map((item) => (
                <span className="dish-item" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function RestaurantBlock({ restaurant }: { restaurant: RestaurantMenu }) {
  return (
    <section className="restaurant-section" aria-labelledby={`${restaurant.id}-title`}>
      <header className="restaurant-header">
        <div>
          <h2 id={`${restaurant.id}-title`}>
            <Building2 size={22} strokeWidth={1.7} aria-hidden="true" />
            {restaurant.name}
          </h2>
          <p>
            <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
            {restaurant.location}
          </p>
        </div>
        <div className="restaurant-source">
          <FileSpreadsheet size={15} strokeWidth={1.8} aria-hidden="true" />
          {restaurant.source}
        </div>
      </header>

      <div className="meals-grid">
        {restaurant.meals.map((meal) => (
          <MealPanel meal={meal} key={`${restaurant.id}-${meal.name}`} />
        ))}
      </div>
    </section>
  )
}

function App() {
  const { day, isFallback, requestedDate } = getVisibleDay()

  return (
    <main className="app-shell">
      <header className="top-area">
        <div className="title-group">
          <h1>今日餐谱</h1>
          <p className="date-line">
            <CalendarDays size={19} strokeWidth={1.8} aria-hidden="true" />
            {formatDateLine(day)}
          </p>
        </div>

        <figure className="food-visual" aria-label="餐厅餐食拼盘">
          <img src={canteenSpread} alt="" />
        </figure>
      </header>

      {isFallback && (
        <p className="coverage-note">
          当前日期 {requestedDate} 不在本周菜单范围内，暂显示 {day.label} 的餐谱。
        </p>
      )}

      <div className="menu-stack">
        {day.restaurants.map((restaurant) => (
          <RestaurantBlock restaurant={restaurant} key={restaurant.id} />
        ))}
      </div>

      <footer className="page-footer">
        <span>
          <Clock3 size={15} strokeWidth={1.8} aria-hidden="true" />
          菜单周期：{menuRange}
        </span>
        <span>菜品可能随当日供应调整，以餐厅实际出品为准。</span>
      </footer>
    </main>
  )
}

export default App
