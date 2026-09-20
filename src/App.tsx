import { Navigate, Route, Routes } from 'react-router-dom'
import NavBar from './components/NavBar'
import StorageBanner from './components/StorageBanner'
import { todayKey } from './domain/date'
import AddEntryPage from './pages/AddEntryPage'
import EditEntryPage from './pages/EditEntryPage'
import FoodEditPage from './pages/FoodEditPage'
import FoodsPage from './pages/FoodsPage'
import RecipeEditPage from './pages/RecipeEditPage'
import RecipesPage from './pages/RecipesPage'
import SettingsPage from './pages/SettingsPage'
import TodayPage from './pages/TodayPage'

export default function App() {
  return (
    <>
      <StorageBanner />
      <main className="pb-6 pt-1">
        <Routes>
          {/* The selected day lives in the URL so add/edit flows can return to it. */}
          <Route path="/" element={<Navigate to={`/day/${todayKey()}`} replace />} />
          <Route path="/day/:date" element={<TodayPage />} />
          <Route path="/day/:date/add/:meal" element={<AddEntryPage />} />
          <Route path="/day/:date/entry/:entryId" element={<EditEntryPage />} />
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
      <NavBar />
    </>
  )
}
