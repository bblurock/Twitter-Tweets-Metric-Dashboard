class Dashing.Shared extends Dashing.Widget

  ready: ->
    ###*
    # Dark theme for Highcharts JS
    # @author Torstein Honsi
    ###

    # Load the fonts
    Highcharts.createElement 'link', {
      href: '//fonts.googleapis.com/css?family=Unica+One'
      rel: 'stylesheet'
      type: 'text/css'
    }, null, document.getElementsByTagName('head')[0]
    Highcharts.theme =
      colors: [
        '#2b908f'
        '#90ee7e'
        '#f45b5b'
        '#7798BF'
        '#aaeeee'
        '#ff0066'
        '#eeaaee'
        '#55BF3B'
        '#DF5353'
        '#7798BF'
        '#aaeeee'
      ]
      chart:
        backgroundColor:
          linearGradient:
            x1: 0
            y1: 0
            x2: 1
            y2: 1
          stops: [
            [
              0
              '#2a2a2b'
            ]
            [
              1
              '#3e3e40'
            ]
          ]
        style: fontFamily: '\'Open Sans\', sans-serif'
        plotBorderColor: '#606063'
      title: style:
        color: '#E0E0E3'
        textTransform: 'uppercase'
        fontSize: '20px'
      subtitle: style:
        color: '#E0E0E3'
        textTransform: 'uppercase'
      xAxis:
        gridLineColor: '#707073'
        labels: style: color: '#E0E0E3'
        lineColor: '#707073'
        minorGridLineColor: '#505053'
        tickColor: '#707073'
        title: style: color: '#A0A0A3'
      yAxis:
        gridLineColor: '#707073'
        labels: style: color: '#E0E0E3'
        lineColor: '#707073'
        minorGridLineColor: '#505053'
        tickColor: '#707073'
        tickWidth: 1
        title: style: color: '#A0A0A3'
      tooltip:
        backgroundColor: 'rgba(0, 0, 0, 0.85)'
        style: color: '#F0F0F0'
      plotOptions:
        series:
          dataLabels: color: '#B0B0B3'
          marker: lineColor: '#333'
        boxplot: fillColor: '#505053'
        candlestick: lineColor: 'white'
        errorbar: color: 'white'
      legend:
        itemStyle: color: '#E0E0E3'
        itemHoverStyle: color: '#FFF'
        itemHiddenStyle: color: '#606063'
      credits: style: color: '#666'
      labels: style: color: '#707073'
      drilldown:
        activeAxisLabelStyle: color: '#F0F0F3'
        activeDataLabelStyle: color: '#F0F0F3'
      navigation: buttonOptions:
        symbolStroke: '#DDDDDD'
        theme: fill: '#505053'
      rangeSelector:
        buttonTheme:
          fill: '#505053'
          stroke: '#000000'
          style: color: '#CCC'
          states:
            hover:
              fill: '#707073'
              stroke: '#000000'
              style: color: 'white'
            select:
              fill: '#000003'
              stroke: '#000000'
              style: color: 'white'
        inputBoxBorderColor: '#505053'
        inputStyle:
          backgroundColor: '#333'
          color: 'silver'
        labelStyle: color: 'silver'
      navigator:
        handles:
          backgroundColor: '#666'
          borderColor: '#AAA'
        outlineColor: '#CCC'
        maskFill: 'rgba(255,255,255,0.1)'
        series:
          color: '#7798BF'
          lineColor: '#A6C7ED'
        xAxis: gridLineColor: '#505053'
      scrollbar:
        barBackgroundColor: '#808083'
        barBorderColor: '#808083'
        buttonArrowColor: '#CCC'
        buttonBackgroundColor: '#606063'
        buttonBorderColor: '#606063'
        rifleColor: '#FFF'
        trackBackgroundColor: '#404043'
        trackBorderColor: '#404043'
      legendBackgroundColor: 'rgba(0, 0, 0, 0.5)'
      background2: '#505053'
      dataLabelsColor: '#B0B0B3'
      textColor: '#C0C0C0'
      contrastTextColor: '#F0F0F3'
      maskColor: 'rgba(255,255,255,0.3)'
    # Apply the theme
    Highcharts.setOptions Highcharts.theme

  createChart: (seriesOptions) ->
    $('#shared').highcharts 'StockChart',
      title: text: 'Daily Original Shared Count<br/>(by Twitter Webapp)'
      legend: enabled: true
      # subtitle: text: 'This chart display the number of times which their tweets be retweeted by other user. <br/>!! Note: only the most recent 3200 tweets will be counted.'
      rangeSelector: selected: 4
      legend: enabled: true
      yAxis:
        plotLines: [ {
          value: 0
          width: 1
          color: 'silver'
        } ]
        min: 0
      plotOptions:
        series:
          lineWidth: 1
          # compares: 'value'
        spline:
          marker:
            enabled: true
      
      tooltip:
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: {point.y}<br/>'
        valueDecimals: 0
      series: seriesOptions
    return

  onData: (data) ->
    
    data = JSON.parse(data.data)
    
    legendDefault = {
      "tickleapp": true,
      "wonderworkshop": false, 
      "spheroedu": false,
      "gotynker": false,
      "hopscotch": false,
      "codehs": false,
      "kodable": false,
      "codeorg": false,
      "scratch": false,
      "trinketapp": false
    }
    
    data.map (x) ->
      x.visible = legendDefault[x.name]
      
    @createChart(data)