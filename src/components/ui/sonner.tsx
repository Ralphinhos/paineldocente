import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
    >
      {/* This is a conceptual placement. Sonner's actual API for custom elements might differ.
          If Sonner doesn't directly support adding child elements here for progress,
          we might need to use CSS to style an existing (but hidden) progress bar,
          or Sonner might provide a prop to render a custom progress component.
          The CSS file `custom-sonner-progress.css` is written to target data attributes
          that Sonner might use for its progress bar (`[data-progress]`).
      */}
      {/* Fallback: Manually adding a div that we hope Sonner positions correctly,
          or that our CSS can target and style as a progress bar.
          This specific approach of adding a direct child to <Sonner /> might not work as expected
          depending on how Sonner renders its toasts.
          The CSS approach in `custom-sonner-progress.css` is more robust if Sonner does render a progress element.
      */}
    </Sonner>
  )
}

// It's important to check Sonner's documentation for the correct way to customize toast content or add elements.
// If Sonner doesn't provide a direct way to insert a custom progress bar element via props,
// the primary method of enabling/styling the progress bar will be through CSS,
// targeting the classes/attributes Sonner itself uses for its progress bar.
// The `custom-sonner-progress.css` file attempts to do this.

export { Toaster, toast }
