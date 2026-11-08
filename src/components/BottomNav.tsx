import { NavLink } from 'react-router-dom'

export function BottomNav() {
  return (
    <nav className="tabbar" aria-label="底部导航">
      <NavLink
        to="/"
        end
        className={({ isActive }) => (isActive ? 'tab on' : 'tab')}
      >
        <div className="ico" />
        首页
      </NavLink>
      <span className="tab fab-spacer" aria-hidden="true" />
      <NavLink
        to="/profile"
        className={({ isActive }) => (isActive ? 'tab on' : 'tab')}
      >
        <div className="ico" />
        我的
      </NavLink>
      <NavLink to="/new" className="fab" aria-label="记下">
        +
      </NavLink>
    </nav>
  )
}
