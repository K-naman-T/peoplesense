# Setup script for People Tracking Frontend

# Create Next.js app with TypeScript, Tailwind CSS, and App Router
npx create-next-app@latest . --typescript --tailwind --eslint --app --use-npm

# Install additional dependencies
npm install axios recharts @tanstack/react-query zod react-hook-form class-variance-authority clsx tailwind-merge lucide-react

# Install shadcn UI CLI
npm install -D @shadcn/ui

# Initialize shadcn UI
npx shadcn-ui@latest init

# Install specific shadcn UI components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add select
npx shadcn-ui@latest add form
npx shadcn-ui@latest add separator

# Create project directory structure
mkdir -p app/cameras/[id]/edit
mkdir -p app/cameras/add
mkdir -p app/dashboard
mkdir -p app/settings
mkdir -p components/ui
mkdir -p components/camera-view
mkdir -p components/dashboard
mkdir -p components/layout
mkdir -p hooks
mkdir -p lib/api-client
mkdir -p lib/utils
mkdir -p types

echo "Project setup completed successfully!"
