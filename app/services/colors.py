import colorsys
import random
import math

def hex_from_rgb(r, g, b):
    return "#{:02x}{:02x}{:02x}".format(r, g, b)

def rgb_distance(c1, c2):
    return math.sqrt(sum((a-b)**2 for a,b in zip(c1, c2)))

def generate_distinct_colors(n, seed=42):
    """
    Produces n visually distinct colors.
    Strategy: golden-ratio hue stepping + reject if too close in RGB.
    """
    random.seed(seed)
    colors = []
    rgb_list = []

    golden = 0.61803398875
    h = random.random()

    for _ in range(n):
        for _attempt in range(200):
            h = (h + golden) % 1.0
            s = 0.70
            v = 0.90
            r, g, b = colorsys.hsv_to_rgb(h, s, v)
            rgb = (int(r*255), int(g*255), int(b*255))

            if all(rgb_distance(rgb, existing) > 85 for existing in rgb_list):
                rgb_list.append(rgb)
                colors.append(hex_from_rgb(*rgb))
                break
        else:
            # fallback if we can't find a distinct one
            colors.append(hex_from_rgb(*rgb))

    return colors
