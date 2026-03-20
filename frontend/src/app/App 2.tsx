import { useEffect, useMemo, useState } from 'react';
import { roomTypeInfo } from './data/rooms';
import { Room, RoomTypeInfo, Booking, RoomType, RoomFilters, User } from './types/booking';
import { RoomCard } from './components/RoomCard';
import { BookingModal } from './components/BookingModal';
import { BookingList } from './components/BookingList';
import { FilterPanel } from './components/FilterPanel';
import { LoginPage } from './components/LoginPage';
import { getAvailableRoomsByFilters, isRoomAvailable } from './utils/availability';
import { Building2, Calendar, LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { cancelBooking, createBooking, fetchAllFacilities, fetchBookings } from './utils/fbsApi';

type TabType = 'rooms' | 'bookings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomTypeInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('rooms');
  const [filters, setFilters] = useState<RoomFilters>({
    buildings: [],
    roomTypes: [],
    floors: [],
    minCapacity: 0,
    selectedDate: '',
    selectedStartTime: '',
    selectedEndTime: '',
  });

  const availableBuildings = useMemo(() => {
    const buildings = new Set(rooms.map((r) => r.building).filter(Boolean));
    return Array.from(buildings).sort((a, b) => a.localeCompare(b));
  }, [rooms]);

  function floorFromFacilityId(id: string) {
    const raw = String(id || '');
    const m = raw.match(/-(\d{4})$/);
    if (m?.[1]) {
      const maybe = Number(m[1].slice(0, 2));
      if (Number.isFinite(maybe) && maybe > 0) return maybe;
    }
    return 1;
  }

  function roomTypeForCapacity(facilityId: string, capacity: number, floor: number): RoomType {
    const cap = Number(capacity) || 0;
    if (cap <= 1) {
      // use ID to pick between the two single-person types for variety
      const last = facilityId.slice(-1);
      return Number(last) % 2 === 0 ? 'Study Booth' : 'Phone Booth';
    }
    if (cap <= 3) return 'Chatterbox';
    if (cap <= 4) return 'Meeting Pod';
    if (cap <= 6) return 'Group Study Room';
    if (cap <= 10) return floor === 5 ? 'Project Room (Level 5)' : 'Project Room';
    if (cap <= 25) return 'Seminar Room';
    if (cap <= 80) return 'Classroom';
    if (cap <= 150) return 'SMUC Facilities';
    return 'MPH / Sports Hall';
  }

  async function loadBackendData() {
    setIsDataLoading(true);
    try {
      const facilities = await fetchAllFacilities();

      const nextRooms: Room[] = (facilities || []).map((f) => {
        const id = String(f.id);
        const floor = typeof f.floor === 'number' && Number.isFinite(f.floor) ? f.floor : floorFromFacilityId(id);
        const capacity = Number(f.capacity) || 1;
        return {
          id,
          roomNumber: id,
          building: String(f.building || 'Unknown'),
          floor,
          capacity,
          type: roomTypeForCapacity(id, capacity, floor),
        };
      });

      const roomById = new Map(nextRooms.map((r) => [r.id, r] as const));
      const backendBookings = await fetchBookings();

      const nextBookings: Booking[] = (backendBookings || []).map((b) => {
        const room = roomById.get(String(b.facilityId));
        const date = new Date(`${b.date}T00:00:00`);
        const statusRaw = String(b.status || 'confirmed').toLowerCase();

        return {
          id: String(b.id),
          roomId: String(b.facilityId),
          roomNumber: room?.roomNumber || String(b.facilityId),
          roomType: room?.type || 'Classroom',
          building: room?.building || 'Unknown',
          userEmail: String(b.userEmail || ''),
          date,
          startTime: String(b.start),
          endTime: String(b.end),
          numberOfAttendees: 1,
          purpose: String(b.reason || ''),
          status: statusRaw === 'cancelled' ? 'cancelled' : 'confirmed',
          createdAt: new Date(),
        };
      });

      setRooms(nextRooms);
      setBookings(nextBookings);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load data from backend');
    } finally {
      setIsDataLoading(false);
    }
  }

  // Handle login
  const handleLogin = (userData: User) => {
    setUser(userData);
    toast.success(`Welcome, ${userData.name}!`);
  };

  // Handle logout
  const handleLogout = () => {
    setUser(null);
    setActiveTab('rooms');
    setRooms([]);
    setBookings([]);
    toast.info('Logged out successfully');
  };

  useEffect(() => {
    if (!user) return;
    // Keep data fresh on login or refresh
    void loadBackendData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  // Get available floors from rooms
  const availableFloors = useMemo(() => {
    const floors = new Set(rooms.map((r) => r.floor));
    return Array.from(floors);
  }, [rooms]);

  // Filter rooms based on current filters
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (filters.buildings.length > 0 && !filters.buildings.includes(room.building)) return false;
      if (filters.roomTypes.length > 0 && !filters.roomTypes.includes(room.type)) return false;
      if (filters.floors.length > 0 && !filters.floors.includes(room.floor.toString())) return false;
      if (filters.minCapacity > 0 && (Number(room.capacity) || 0) < filters.minCapacity) return false;
      return true;
    });
  }, [rooms, filters]);

  // Calculate available rooms by type based on selected date/time or default to next slot
  const availableRoomsByType = useMemo(() => {
    const filterDate = filters.selectedDate ? new Date(filters.selectedDate) : null;
    
    const allAvailability = getAvailableRoomsByFilters(
      filteredRooms,
      bookings,
      filterDate,
      filters.selectedStartTime,
      filters.selectedEndTime
    );

    const counts: Record<RoomType, number> = {
      'Catering Area': 0,
      'Chatterbox': 0,
      'Classroom': 0,
      'Group Study Room': 0,
      'Hostel Facilities': 0,
      'Meeting Pod': 0,
      'MPH / Sports Hall': 0,
      'Phone Booth': 0,
      'Project Room': 0,
      'Project Room (Level 5)': 0,
      'Seminar Room': 0,
      'SMUC Facilities': 0,
      'Study Booth': 0,
    };

    Object.keys(allAvailability).forEach((type) => {
      counts[type as RoomType] = allAvailability[type];
    });

    return counts;
  }, [filteredRooms, bookings, filters]);

  const availableRoomsCount = useMemo(() => {
    return Object.values(availableRoomsByType).reduce((sum, count) => sum + count, 0);
  }, [availableRoomsByType]);

  const handleBookNow = (roomType: RoomTypeInfo) => {
    setSelectedRoomType(roomType);
    setIsModalOpen(true);
  };

  const handleBookingSubmit = async (
    bookingData: Pick<Booking, 'roomType' | 'date' | 'startTime' | 'endTime' | 'numberOfAttendees' | 'purpose'>
  ) => {
    // Find an available room of the selected type from filtered rooms that doesn't have a conflict
    const availableRoom = filteredRooms.find((room) => {
      if (room.type !== bookingData.roomType) return false;
      return isRoomAvailable(room, bookingData.date, bookingData.startTime, bookingData.endTime, bookings);
    });

    if (!availableRoom) {
      toast.error('No rooms available for this type at the selected time');
      return;
    }

    if (!user?.email) {
      toast.error('Please sign in again to book a room');
      return;
    }

    const dateStr = bookingData.date.toISOString().split('T')[0];

    try {
      const resp: any = await createBooking({
        facilityId: availableRoom.id,
        date: dateStr,
        start: bookingData.startTime,
        end: bookingData.endTime,
        userEmail: user.email,
        reason: bookingData.purpose,
      });

      setIsModalOpen(false);
      setSelectedRoomType(null);

      toast.success(`Room ${availableRoom.roomNumber} booked at ${availableRoom.building}!`);

      await loadBackendData();
      setActiveTab('bookings');
    } catch (e: any) {
      if (e?.status === 409) {
        toast.error('That slot was just taken. Try again or adjust time.');
        await loadBackendData();
        return;
      }
      toast.error(e?.message || 'Booking failed');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!user?.email) {
      toast.error('Please sign in again to cancel bookings');
      return;
    }

    try {
      await cancelBooking(bookingId, user.email);
      toast.success('Booking cancelled successfully');
      await loadBackendData();
    } catch (e: any) {
      toast.error(e?.message || 'Cancellation failed');
    }
  };

  // Show login page if user is not logged in
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const getAvailabilityMessage = () => {
    if (filters.selectedDate && filters.selectedStartTime && filters.selectedEndTime) {
      const date = new Date(filters.selectedDate).toLocaleDateString();
      return `${availableRoomsCount} rooms available on ${date} from ${filters.selectedStartTime} to ${filters.selectedEndTime}`;
    }
    return `${availableRoomsCount} rooms available for next time slot`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Campus Room Booking</h1>
                <p className="text-gray-600">
                  {rooms.length} spaces across {availableBuildings.length || 0} buildings • 3-hour max booking
                </p>
              </div>
            </div>
            
            {/* User Profile and Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-2 text-gray-900 font-medium">
                  <UserIcon className="w-4 h-4" />
                  {user.name}
                </div>
                <div className="text-sm text-gray-600">{user.department}</div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'rooms'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Available Rooms
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === 'bookings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              My Bookings
              {bookings.filter((b) => b.status === 'confirmed' && b.userEmail === user.email).length > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {bookings.filter((b) => b.status === 'confirmed' && b.userEmail === user.email).length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'rooms' && (
          <div>
            <FilterPanel
              filters={filters}
              onFilterChange={setFilters}
              availableFloors={availableFloors}
              availableBuildings={availableBuildings}
            />
            
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Browse Available Spaces</h2>
              <p className="text-gray-600">
                {getAvailabilityMessage()}
                {isDataLoading && ' • loading…'}
              </p>
            </div>
            
            {filteredRooms.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow-md">
                <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No Rooms Match Your Filters</h3>
                <p className="text-gray-600 mb-4">Try adjusting your filters to see more results</p>
                <button
                  onClick={() => setFilters({ 
                    buildings: [], 
                    roomTypes: [], 
                    floors: [], 
                    minCapacity: 0,
                    selectedDate: '',
                    selectedStartTime: '',
                    selectedEndTime: '',
                  })}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roomTypeInfo.map((roomType) => {
                  const availableCount = availableRoomsByType[roomType.type];
                  const totalCount = filteredRooms.filter((r) => r.type === roomType.type).length;
                  
                  if (totalCount === 0) return null;
                  
                  return (
                    <RoomCard
                      key={roomType.type}
                      roomType={roomType}
                      availableRooms={availableCount}
                      onBookNow={handleBookNow}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'bookings' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Your Bookings</h2>
              <p className="text-gray-600">
                {bookings.filter((b) => b.status === 'confirmed' && b.userEmail === user.email).length} active booking
                {bookings.filter((b) => b.status === 'confirmed' && b.userEmail === user.email).length !== 1 ? 's' : ''}
              </p>
            </div>
            <BookingList 
              bookings={bookings.filter((b) => b.userEmail === user.email)} 
              onCancelBooking={handleCancelBooking} 
            />
          </div>
        )}

      </main>

      {/* Booking Modal */}
      <BookingModal
        roomType={selectedRoomType}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedRoomType(null);
        }}
        onSubmit={handleBookingSubmit}
      />
    </div>
  );
}
