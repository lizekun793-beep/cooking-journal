import { useLayoutEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useJournal } from '../context/JournalContext'
import { BottomNav } from './BottomNav'

const NAV_PATHS = new Set(['/', '/profile'])

export function Shell() {
  const { pathname } = useLocation()
  const { saveError } = useJournal()
  const showNav = NAV_PATHS.has(pathname)
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="canvas">
      <div className="phone">
        <div className="phone-scroll" ref={scrollRef}>
          <Outlet />
        </div>
        {saveError ? (
          <div className="save-toast" role="alert">
            {saveError}
          </div>
        ) : null}
        {showNav ? <BottomNav /> : null}
      </div>
    </div>
  )
}
