import GameChat from "./components/GameChat";
import AdminPanel from "./admin/AdminPanel";

function App() {
    if (window.location.pathname.startsWith("/admin")) return <AdminPanel />;
    const currentUser = {
        id: "1",
        username: sessionStorage.getItem("chatUsername") || "Eva"
    };
    return <GameChat currentUser={currentUser} accessToken={null} />;
}
export default App;
