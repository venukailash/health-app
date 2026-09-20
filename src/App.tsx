import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useKeyboardOpen } from './hooks/useKeyboardOpen'
import StorageBanner from './components/StorageBanner'
import Toaster from './components/Toaster'
import { todayKey } from './domain/date'
import AddEntryPage from './pages/AddEntryPage'
import EditEntryPage from './pages/EditEntryPage'
import FoodEditPage from './pages/FoodEditPage'
import FoodsPage from './pages/FoodsPage'
import RecipeEditPage from './pages/RecipeEditPage'
import MonthPage from './pages/MonthPage'
import RecipesPage from './pages/RecipesPage'
import SettingsPage from './pages/SettingsPage'
import TodayPage from './pages/TodayPage'
import WeekPage from './pages/WeekPage'

export default function App() {
  const keyboardOpen = useKeyboardOpen()
  useAppUpdate()

  return (
    <>
      <StorageBanner />
      <main
        className="pt-1"
        // The bottom padding exists to clear the fixed nav bar; with the bar
        // hidden it would just be dead space under the keyboard.
        style={{ paddingBottom: keyboardOpen ? '1rem' : '1.5rem' }}
      >
        <Routes>
          {/* The selected day lives in the URL so add/edit flows can return to it. */}
          <Route path="/" element={<Navigate to={`/day/${todayKey()}`} replace />} />
          <Route path="/day/:date" element={<TodayPage />} />
          <Route path="/day/:date/add/:meal" element={<AddEntryPage />} />
          <Route path="/day/:date/entry/:entryId" element={<EditEntryPage />} />
          <Route path="/week/:date" element={<WeekPage />} />
          <Route path="/month/:date" element={<MonthPage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/foods/new" element={<FoodEditPage />} />
          <Route path="/foods/:id" element={<FoodEditPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/recipes/new" element={<RecipeEditPage />} />
          <Route path="/recipes/:id" element={<RecipeEditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toaster />
      <NavBar />
    </>
  )
}
