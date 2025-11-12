# Focal Deploy Dashboard

Modern, responsive admin dashboard for Focal Deploy SaaS platform built with Next.js 14, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Authentication** - Secure login/register with JWT tokens
- **Dashboard** - Real-time analytics and deployment metrics
- **Deployments** - Full CRUD management with status tracking
- **Credentials** - Encrypted credential storage (AWS, DigitalOcean, etc.)
- **Usage Analytics** - Track usage, export data, view tier limits
- **API Documentation** - Interactive API explorer
- **Billing** - Subscription management and pricing tiers
- **Super Admin** - DFY (Done For You) account management

## 📁 Project Structure

```
dashboard/
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── (auth)/            # Auth pages (login, register)
│   │   ├── (dashboard)/       # Dashboard pages
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Home/landing page
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   ├── charts/            # Chart components
│   │   ├── forms/             # Form components
│   │   └── layout/            # Layout components (nav, sidebar)
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   ├── auth.ts            # Auth utilities
│   │   └── utils.ts           # Helper functions
│   ├── hooks/                 # Custom React hooks
│   ├── stores/                # Zustand stores
│   └── types/                 # TypeScript types
├── public/                    # Static assets
├── tailwind.config.ts         # Tailwind configuration
├── next.config.js             # Next.js configuration
└── package.json               # Dependencies
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://api.focuswithfocal.io
NEXT_PUBLIC_APP_URL=https://app.focuswithfocal.io
```

### 3. Run Development Server

```bash
npm run dev
```

Dashboard will be available at `http://localhost:3001`

### 4. Build for Production

```bash
npm run build
npm start
```

## 🎨 Design System

### Colors
- **Primary**: Blue (#3B82F6)
- **Success**: Green (#10B981)
- **Warning**: Yellow (#F59E0B)
- **Danger**: Red (#EF4444)
- **Dark**: (#1F2937)

### Typography
- **Headings**: Inter font, bold
- **Body**: Inter font, regular
- **Code**: Mono font

## 📄 Key Pages

### Authentication
- `/login` - Login page
- `/register` - Registration page
- `/forgot-password` - Password reset

### Dashboard
- `/dashboard` - Main analytics dashboard
- `/dashboard/deployments` - Deployment management
- `/dashboard/deployments/[id]` - Deployment details
- `/dashboard/credentials` - Credential management
- `/dashboard/usage` - Usage analytics
- `/dashboard/billing` - Subscription & billing
- `/dashboard/api-docs` - API documentation
- `/dashboard/settings` - User settings

### Super Admin (DFY)
- `/admin` - Super admin dashboard
- `/admin/clients` - Client management
- `/admin/deployments` - All client deployments

## 🔐 Authentication Flow

1. User logs in via `/login`
2. JWT token stored in httpOnly cookie
3. Token included in all API requests via interceptor
4. Token refresh handled automatically
5. Logout clears token and redirects to login

## 📊 Dashboard Components

### Analytics Cards
- Total Deployments
- Active Instances
- This Month's Usage
- Current Tier

### Charts
- Deployment trends (line chart)
- Usage by resource type (bar chart)
- Tier limits vs current usage (progress bars)

### Tables
- Deployments list (sortable, filterable, paginated)
- Credentials list (masked values)
- Usage history (exportable)

## 🔌 API Integration

### API Client (`src/lib/api.ts`)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true
});

// Auto-attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### API Endpoints

```typescript
// Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout

// Deployments
GET    /api/deployments
POST   /api/deployments
GET    /api/deployments/:id
PATCH  /api/deployments/:id
DELETE /api/deployments/:id

// Credentials
GET    /api/credentials
POST   /api/credentials
GET    /api/credentials/:id
PATCH  /api/credentials/:id
DELETE /api/credentials/:id

// Usage
GET /api/usage
GET /api/usage/history
GET /api/usage/limits
GET /api/usage/export?format=csv

// Billing
GET  /api/billing/subscription
POST /api/billing/subscription
GET  /api/billing/invoices

// Pricing (public)
GET /api/pricing
GET /api/pricing/:tier
```

## 🎯 State Management

Using **Zustand** for global state:

```typescript
// stores/authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: async (email, password) => {
    const response = await api.post('/api/auth/login', { email, password });
    set({ user: response.data.user, token: response.data.token });
  },
  logout: () => {
    set({ user: null, token: null });
  }
}));
```

## 📱 Responsive Design

- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

Sidebar collapses to hamburger menu on mobile.

## 🚢 Deployment

### Option 1: Vercel (Recommended)

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option 2: Nginx + PM2

```bash
# Build
npm run build

# Start with PM2
pm2 start npm --name "focal-dashboard" -- start

# Nginx config
server {
    listen 443 ssl http2;
    server_name app.focuswithfocal.io;

    ssl_certificate /etc/letsencrypt/live/focuswithfocal.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/focuswithfocal.io/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🎨 Component Examples

### Button Component

```typescript
// components/ui/Button.tsx
import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-semibold transition-colors',
        {
          'bg-blue-600 hover:bg-blue-700 text-white': variant === 'primary',
          'bg-gray-200 hover:bg-gray-300 text-gray-900': variant === 'secondary',
          'bg-red-600 hover:bg-red-700 text-white': variant === 'danger',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-base': size === 'md',
          'px-6 py-3 text-lg': size === 'lg',
          'opacity-50 cursor-not-allowed': loading
        },
        className
      )}
      disabled={loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  );
}
```

### Card Component

```typescript
// components/ui/Card.tsx
export function Card({ title, value, trend, icon }: {
  title: string;
  value: string | number;
  trend?: { value: number; direction: 'up' | 'down' };
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {trend && (
            <p className={clsx(
              'text-sm mt-2',
              trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
            )}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
            </p>
          )}
        </div>
        <div className="text-blue-600">
          {icon}
        div>
      </div>
    </div>
  );
}
```

## 🔒 Super Admin Access

### How to Make Yourself Super Admin

**Method 1: Database Update**

```sql
-- Connect to PostgreSQL
psql -U focal_deploy -d focal_deploy_saas

-- Make your account super admin
UPDATE users
SET role = 'super_admin'
WHERE email = 'your@email.com';

-- Verify
SELECT email, role FROM users WHERE role = 'super_admin';
```

**Method 2: API Endpoint (Create this)**

```typescript
// saas-server/routes/admin.js (protected route - manual first-time setup)
router.post('/make-super-admin', async (req, res) => {
  const { email, secretKey } = req.body;

  // Check secret key from .env
  if (secretKey !== process.env.SUPER_ADMIN_SECRET) {
    return res.status(403).json({ error: 'Invalid secret key' });
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await user.update({ role: 'super_admin' });

  res.json({ message: 'User is now super admin' });
});
```

### Super Admin Features

- View all clients
- Impersonate any user
- Deploy on behalf of clients (DFY)
- Access all deployments
- Manage all credentials
- View aggregated analytics

## 📚 API Documentation Page

The dashboard includes an interactive API documentation page at `/dashboard/api-docs` with:

- Live API endpoint testing
- Request/response examples
- Authentication helpers
- Code snippets (curl, JavaScript, Python)

## 🎯 Rate Limiting

Already configured in API:
- General endpoints: 100 requests per 15 minutes
- Login endpoint: 5 attempts per 15 minutes

## 📈 Next Steps

1. **Complete the UI** - Build all pages using the examples above
2. **Add Real-time Updates** - WebSockets for deployment status
3. **Add Notifications** - Toast messages for actions
4. **Add Dark Mode** - Toggle in settings
5. **Add Team Management** - Invite team members (Pro+ tiers)
6. **Add Webhooks** - Configure deployment webhooks
7. **Add Audit Log** - Track all user actions

## 🤝 Support

- Documentation: https://docs.focuswithfocal.io
- API: https://api.focuswithfocal.io
- Support: support@focuswithfocal.com

## 📝 License

Proprietary - © 2025 Focal Deploy / DNS Publishing, LLC
