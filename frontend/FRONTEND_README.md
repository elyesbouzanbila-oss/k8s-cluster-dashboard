# K8s Dashboard Frontend

Modern React + TypeScript + Vite dashboard for Kubernetes cluster monitoring with network discovery, security audits, and real-time threat detection.

## Features

### 🌐 Network Tab
- **Pod Discovery**: List all pods across namespaces with metadata (IP, node, containers)
- **Cluster Topology**: Visualize pods and services as graph nodes
- **Real-time Updates**: Refresh pod/topology data on demand
- **Container Info**: Show container names and images for each pod
- **Labels**: Display Kubernetes labels for filtering and identification

### 🔐 Security Tab
- **RBAC Audit**: List all ClusterRoleBindings and RoleBindings
- **Elevated Access Detection**: Flag cluster-admin users with warning badges
- **Privileged Pod Detection**: Identify high-risk pods running as root or in privileged mode
- **Security Context Analysis**: Show privileged/runAsUser flags
- **Risk Indicators**: Visual alerts for security concerns

### ⚠️ Threats Tab
- **Real-time Threat Stream**: WebSocket connection for live Falco events
- **Priority Classification**: Critical, High, Medium, Warning color-coding
- **Event Details**: Rule name, message, timestamp for each threat
- **Connection Status**: Visual indicator of WebSocket connection health
- **Auto-reconnect**: Automatically reconnects if connection drops

## Tech Stack

- **React 19.2.6**: Modern UI library
- **TypeScript 6.0**: Type-safe development
- **Vite 8.0**: Fast build tool with HMR
- **ESLint**: Code quality
- **CSS3**: Modern styling with CSS variables

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx          # Main app component (1,400+ lines)
│   ├── App.css          # Comprehensive styling (400+ lines)
│   ├── main.tsx         # Entry point
│   ├── index.css        # Global styles
│   └── assets/          # Images and logos
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript config
├── package.json         # Dependencies
├── Dockerfile           # Container image
└── README.md            # This file
```

## Setup & Installation

### Local Development

#### 1. Prerequisites
- Node.js 18+ (check: `node --version`)
- npm 9+ (check: `npm --version`)

#### 2. Install Dependencies
```bash
cd frontend
npm install
```

#### 3. Configure Backend Connection
Create or edit `.env.local`:
```env
VITE_API_URL=http://localhost:8000
VITE_API_KEY=your-secret-api-key-change-this
```

#### 4. Start Development Server
```bash
npm run dev
```

Server starts at `http://localhost:5173`

#### 5. Open in Browser
```
http://localhost:5173
```

### Docker Development

#### With Docker Compose (Recommended)
```bash
# From root directory
docker compose up

# Backend: http://localhost:8000
# Frontend: http://localhost:5173
# Redis: localhost:6379
```

#### Build Docker Image Manually
```bash
docker build -t k8s-dashboard-frontend .
docker run -p 5173:5173 k8s-dashboard-frontend
```

## API Integration

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |
| `VITE_API_KEY` | `your-secret-api-key-change-this` | API authentication key |

### Authentication

All API calls include `X-API-Key` header:
```typescript
fetch(`${API_BASE_URL}/api/network/pods`, {
  headers: { 'X-API-Key': API_KEY }
})
```

### API Endpoints

#### Network Discovery
```
GET /api/network/pods
GET /api/network/topology
```

#### Security Audit
```
GET /api/security/rbac
GET /api/security/privileged
```

#### Threat Detection
```
POST /api/threats/falco          # Send events
WebSocket /api/threats/ws/threats # Subscribe to events
```

## Component Overview

### App Component (1,400+ lines)

**State Management**:
- `activeTab`: Current view (network/security/threats)
- `pods`: Array of Pod objects
- `topology`: Graph structure with nodes and edges
- `rbacBindings`: Array of RBAC bindings
- `privilegedPods`: Array of high-risk pods
- `threats`: Array of threat events
- `wsConnected`: WebSocket connection status

**Functions**:
- `fetchPods()`: GET network pods
- `fetchTopology()`: GET cluster topology
- `fetchRbac()`: GET RBAC bindings
- `fetchPrivilegedPods()`: GET privileged pods
- `connectWebSocket()`: Real-time threat stream
- `getPriorityColor()`: Map threat priority to color

### Styling (400+ lines)

**CSS Variables** (Dark Theme):
- `--primary-color`: #0066cc (Blue)
- `--secondary-color`: #00aa44 (Green)
- `--danger-color`: #ff3333 (Red)
- `--warning-color`: #ffaa00 (Orange)
- `--bg-color`: #0d1117 (Dark)
- `--surface-color`: #161b22 (Slightly lighter)
- `--border-color`: #30363d (Subtle)

**Component Styles**:
- Header with status indicator
- Tab navigation with active state
- Error banner with dismiss
- Pod cards with hover effects
- RBAC cards with admin highlighting
- Privilege pod cards with risk badges
- Threat cards with priority color coding
- Scrollable threat list
- Responsive grid layouts
- Mobile-friendly design

## Usage

### 1. Network Discovery

**View Pods**:
1. Click "Network" tab
2. See list of all pods by namespace
3. Each pod shows IP, node, phase, containers, labels
4. Hover for additional details

**View Topology**:
1. Click "Network" tab
2. See "Topology" section
3. Displays pods (📦) and services (⚙️)
4. Click refresh to update

### 2. Security Audit

**Review RBAC**:
1. Click "Security" tab
2. See all RBAC bindings
3. Admin bindings highlighted in orange
4. Click to expand subject details

**Identify Privileges**:
1. Click "Security" tab
2. See "Privileged Pods" section
3. High-risk badges for privileged/root pods
4. Red border indicates security concern

### 3. Monitor Threats

**Real-time Alerts**:
1. Click "Threats" tab
2. WebSocket connects automatically
3. New events appear at top of list
4. Color-coded by priority (Critical→Warning)
5. Green indicator when connected

**Event Details**:
- Rule name (Falco rule identifier)
- Priority badge
- Full message text
- Timestamp (updated every second)

## Data Types

### Pod
```typescript
interface Pod {
  name: string
  namespace: string
  pod_ip: string
  node_name: string
  phase: string
  labels: Record<string, string>
  containers: Array<{ name: string; image: string }>
}
```

### RBAC Binding
```typescript
interface RbacBinding {
  name: string
  namespace?: string
  binding_type: string
  role_ref: { kind: string; name: string; api_group: string }
  subjects: Array<{ kind: string; name: string; namespace?: string }>
}
```

### Threat Event
```typescript
interface ThreatEvent {
  priority: 'Critical' | 'High' | 'Medium' | 'Warning'
  rule: string
  output: string
  time: string
}
```

## Error Handling

**Missing K8s Cluster**:
- Network/Security endpoints show "No data found" message
- Backend returns 500 error (expected)
- Frontend displays user-friendly message

**API Connection Failed**:
- Error banner appears at top
- Shows connection error details
- Dismiss button to close

**WebSocket Connection Failed**:
- Threat status shows "Disconnected"
- Auto-reconnects every 3 seconds
- Reconnect attempts logged in console

## Styling & Theming

### Dark Theme
Pre-configured dark theme optimized for monitoring dashboards.

### Custom Theme
Edit CSS variables in `App.css`:
```css
:root {
  --primary-color: #your-color;
  --secondary-color: #your-color;
  /* ... */
}
```

### Responsive Design
- Desktop: Full 3-column layout
- Tablet: 1-2 columns
- Mobile: Single column (vertical scroll)

## Development

### Run Development Server
```bash
npm run dev
```

HMR (Hot Module Replacement) enabled - changes reflect instantly.

### Build for Production
```bash
npm run build
```

Outputs optimized bundle to `dist/` directory.

### Lint Code
```bash
npm run lint
```

Checks code quality with ESLint.

### Preview Production Build
```bash
npm run preview
```

Serves production build locally.

## Production Deployment

### Docker Deployment
```bash
# Build image
docker build -t k8s-dashboard-frontend:1.0.0 .

# Run container
docker run -e VITE_API_URL=https://api.example.com \
           -e VITE_API_KEY=your-key \
           -p 80:5173 \
           k8s-dashboard-frontend:1.0.0
```

### Environment Variables (Production)
```env
VITE_API_URL=https://k8s-dashboard.yourdomain.com/api
VITE_API_KEY=your-production-key
```

### Nginx Configuration
```nginx
server {
    listen 80;
    server_name k8s-dashboard.example.com;

    location / {
        proxy_pass http://frontend:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
# Or use different port
npm run dev -- --port 3000
```

### Cannot Connect to Backend
- Check backend is running: `http://localhost:8000/`
- Check API key in `.env.local`
- Check `VITE_API_URL` is correct
- Check CORS is enabled in backend

### WebSocket Connection Failed
- Check WebSocket proxy in backend
- Verify `ws://` or `wss://` protocol
- Check API key is valid

### Styling Looks Wrong
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Rebuild: `npm run build`
- Check CSS variables are set

### TypeScript Errors
- Run `npm install` to update dependencies
- Rebuild: `npm run build`
- Check `tsconfig.json` is valid

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Optimization

- Code splitting for lazy loading
- CSS variables for efficient theming
- Minimal dependencies (~25KB gzipped)
- Optimized re-renders with React hooks
- Efficient WebSocket event handling (keep last 50)

## Security

- API key stored in environment variables (not committed)
- CORS headers validated by backend
- No sensitive data in local storage
- HTTPS recommended for production
- Content Security Policy recommended

## Testing (Manual)

### Network Tab
1. Visit `http://localhost:5173`
2. Go to Network tab
3. Verify pods load (or "No pods" if K8s not configured)
4. Check pod details display correctly

### Security Tab
1. Go to Security tab
2. Verify RBAC bindings load
3. Check privileged pods highlighted
4. Verify admin badge on cluster-admin bindings

### Threats Tab
1. Go to Threats tab
2. Check connection indicator
3. Send Falco event: See threat appear immediately
4. Verify color-coding by priority

## Next Steps

1. **Connect K8s Cluster**: Configure backend kubeconfig
2. **Deploy Falco Agent**: Send real threat events
3. **Set Up HTTPS**: For production deployment
4. **Add Authentication**: Integrate SSO/OAuth
5. **Set Up Monitoring**: Monitor frontend performance

## Contributing

- Follow TypeScript best practices
- Keep components under 1500 lines
- Document complex functions
- Test in multiple browsers
- Update this README with changes

## License

MIT

## Support

For issues or questions:
1. Check this README first
2. Review backend logs: `docker logs backend`
3. Check browser console for errors
4. Verify .env variables are correct

---

**Frontend Status**: ✅ Production Ready
**Last Updated**: 2026-01-15
**Version**: 1.0.0
